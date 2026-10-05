/**
 * 明细「自动计算」求值器(2026-10-05,采购入库单金额任务)。
 *
 * 后端 `CalcRuleService` 在保存/生单时**用同一份规则**重算派生列(那才是落库真源);
 * 这里负责界面上的即时反馈 —— 改一格立刻看到金额,不用等保存。
 * 两边口径必须逐条一致,**改公式或改守卫时两个文件一起改**:
 *   · 公式语言:字段名即明细行键(永远中文标签,ADR-0001),支持 + - * / ( );
 *   · 缺失入参按 0 参与运算;
 *   · **入参全空则不写入** —— 否则"单价、数量都没填"的行会因为别的格子被改(如备注)
 *     把手工填的金额抹成 0。
 */

/** 数值化(非数字一律 0,与后端 num() 同口径) */
export function toNum(value) {
  if (value === undefined || value === null || value === '') return 0
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

/** 公式里引用到的字段名(去掉数字字面量) */
export function formulaInputs(expr) {
  const tokens = String(expr ?? '').match(/\d+(?:\.\d+)?|[+\-*/()]|[^\s+\-*/()]+/g) || []
  return [...new Set(tokens.filter((t) => !/^\d+(?:\.\d+)?$/.test(t) && !'+-*/()'.includes(t)))]
}

function isEmptyValue(v) {
  return v === undefined || v === null || String(v).trim() === ''
}

/**
 * 中缀表达式求值(调度场算法;不用 eval/Function,避免动态执行)。
 * @param {string} expr 公式
 * @param {object} vars 变量表(字段名 → 值)
 * @returns {number} 结果;未知变量按 0 计
 */
export function evaluateFormula(expr, vars = {}) {
  const tokens = String(expr ?? '').match(/\d+(?:\.\d+)?|[+\-*/()]|[^\s+\-*/()]+/g) || []
  const prec = { '+': 1, '-': 1, '*': 2, '/': 2 }
  const out = []
  const ops = []
  for (const tk of tokens) {
    if (/^\d+(?:\.\d+)?$/.test(tk)) out.push(parseFloat(tk))
    else if (tk in prec) {
      while (ops.length && ops[ops.length - 1] !== '(' && prec[ops[ops.length - 1]] >= prec[tk]) out.push(ops.pop())
      ops.push(tk)
    } else if (tk === '(') ops.push(tk)
    else if (tk === ')') {
      while (ops.length && ops[ops.length - 1] !== '(') out.push(ops.pop())
      if (ops[ops.length - 1] === '(') ops.pop()
    } else out.push(tk)
  }
  while (ops.length) out.push(ops.pop())

  const stack = []
  for (const t of out) {
    if (typeof t === 'number') { stack.push(t); continue }
    if (!(t in prec)) { stack.push(toNum(vars[t])); continue }
    const b = stack.pop(); const a = stack.pop()
    if (a === undefined || b === undefined) return 0
    stack.push(t === '+' ? a + b : t === '-' ? a - b : t === '*' ? a * b : b === 0 ? 0 : a / b)
  }
  const value = stack.pop()
  return Number.isFinite(value) ? value : 0
}

/** 财务口径十进制四舍五入 —— 与后端 CalcRuleService.round 逐位一致 */
export function roundDecimal(value, digits = 2) {
  const number = Number(value)
  if (!Number.isFinite(number)) return 0
  const factor = 10 ** digits
  const scaled = number * factor
  const tolerance = Number.EPSILON * Math.max(1, Math.abs(scaled)) * 4
  const rounded = scaled >= 0
    ? Math.floor(scaled + 0.5 + tolerance)
    : Math.ceil(scaled - 0.5 - tolerance)
  return rounded / factor
}

/**
 * 就地套用一批规则(规则形态 = 后端 detail.tabs[].calc:{target, formula, round})。
 * @param {Array} rules 规则数组
 * @param {object} row 明细行(键=字段名)
 * @param {object} extraVars 额外变量(如 生产工单的「产品数量」),不写回行
 * @returns {number} 实际写入的规则条数
 */
export function applyCalcRules(rules, row, extraVars = {}) {
  if (!Array.isArray(rules) || !rules.length || !row) return 0
  const vars = { ...row, ...extraVars }
  let applied = 0
  for (const rule of rules) {
    const inputs = formulaInputs(rule.formula)
    if (!inputs.length) continue
    if (inputs.every((name) => isEmptyValue(vars[name]))) continue   // 入参全空 → 不写入
    let value = evaluateFormula(rule.formula, vars)
    if (rule.round != null) value = roundDecimal(value, rule.round)
    row[rule.target] = value
    vars[rule.target] = value
    applied++
  }
  return applied
}
