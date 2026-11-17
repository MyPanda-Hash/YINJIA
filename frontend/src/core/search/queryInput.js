/**
 * 查询区参照字段「输入即查」的条件写入 / 摘标记(纯函数,无 Vue 依赖)。
 *
 * 2026-11-13 用户口径:「报工记录中上方的查询不能只是选择查询的,而是可以输入后就查询的形式」。
 * 已确认:① 输入片段即联想下拉 + 直接回车也能按片段模糊查;② 范围只改报工记录(WO_REPORT_LIST)。
 *
 * 为什么要多一个 `_fuzzy` 控制键:
 *   参照字段的查询条件平时是**等值**(从放大镜/候选里选中 = 选了一个实体);
 *   可用户手打片段时想要的是**子串匹配** —— 两者不能靠"看起来像不像编码"去猜,必须由前端显式标注:
 *   `condition._fuzzy = '产品编码,客户编码'`(逗号分隔的**字段 label**,中文数据键口径不变)
 *   ⇒ 后端对这些字段走 `RTRIM(列) LIKE '%片段%'`;不带该键 ⇒ 维持等值。
 *   `_fuzzy` 以 `_` 开头 ⇒ 后端按控制键跳过,不会进入字段循环(见 QueryService.appendDirectFilters)。
 *
 * 三条交互与写入规则:
 *   · 自由输入后回车(未选候选) → 见下方「回车解析」:能解析出档案编码集合 ⇒ applyCodes(数组),
 *                                 解析不到 ⇒ applyFuzzy(文本片段 + `_fuzzy` 标记)
 *   · 选中候选 / 参照弹窗选行     → applyPicked: 写候选编码 + 把该 label 从 `_fuzzy` 摘掉
 *   · 清空                       → clearField:  删条件值 + 摘标记
 *   名单摘空 ⇒ 删掉 `_fuzzy` 键本身(别给后端留一个空控制键)。
 *
 * 回车解析(2026-11-13 第二轮补强:名称片段也必须查得到):
 *   参照字段的列里存的是**编码**,而用户直接回车时打的常常是**名称片段**(如「钢管」「支架」),
 *   只对编码列 LIKE 会 0 行(用户以为没生效)。所以自由输入回车时前端先按片段去**参照档案**里找,
 *   把命中的档案编码收成数组写进条件 —— 数组语义 = 「这些档案之一」(后端 `IN (...)`)。
 *   一条都命中不到才退化成对编码列 LIKE 的 `_fuzzy`。
 *   三种值形态与后端契约(见 QueryService.appendDirectFilters):
 *     · 编码数组       ⇒ `列 IN (…)`(精确命中一组档案)
 *     · 文本 + `_fuzzy` ⇒ `RTRIM(列) LIKE '%文本%'`
 *     · 文本(无标记)   ⇒ `列 = 文本`(精确等值)
 *
 * 红线:**精确选择永远等值**(放大镜里选中的是一个实体,LIKE 会把「成品仓」串到「半成品仓」),
 *      只有自由输入的片段才 LIKE / 才展开成编码集合。
 */

/** 控制键名:值 = 逗号分隔的字段 label 名单(命中名单的参照字段按 LIKE 过滤) */
export const FUZZY_KEY = '_fuzzy'

/** 编码数组上限:防止名称片段过宽(如「件」)把 IN 列表撑到几千项、拖垮 IN 参数上限与 SQL 计划 */
export const MAX_CODE_LIST = 200

/**
 * 编码数组规范化:去前后空格、去空、去重、保留首次出现的顺序、按上限截断。
 * 非数组(单个编码/undefined/null)也接受 —— 调用方从候选里拿到的可能是单值。
 * @param {Array|string|number|null|undefined} codes 原始编码集合
 * @param {number} [max] 上限(默认 MAX_CODE_LIST)
 * @returns {string[]} 干净的编码数组(从不返回 null;空集合 = [])
 */
export function normalizeCodeList(codes, max = MAX_CODE_LIST) {
  const limit = Math.max(1, Number(max) || MAX_CODE_LIST)
  const list = Array.isArray(codes) ? codes : (codes === undefined || codes === null ? [] : [codes])
  const out = []
  for (const code of list) {
    const value = String(code ?? '').trim()
    if (!value || out.includes(value)) continue
    out.push(value)
    if (out.length >= limit) break
  }
  return out
}

/**
 * 解析 `_fuzzy` 名单。
 * 兼容三种历史/手工写法:控制键不存在 / 逗号分隔字符串 / 数组;逐项去空格、去空、去重,顺序保留。
 * @param {Object|null|undefined} condition 查询条件对象
 * @returns {string[]} 字段 label 名单(从不返回 null)
 */
export function parseFuzzy(condition) {
  const raw = condition ? condition[FUZZY_KEY] : undefined
  if (raw === undefined || raw === null || raw === '') return []
  const parts = Array.isArray(raw) ? raw : String(raw).split(',')
  const out = []
  for (const part of parts) {
    const label = String(part ?? '').trim()
    if (label && !out.includes(label)) out.push(label)
  }
  return out
}

/** 把名单写回控制键:空名单 = 删键(不是写空串) */
function writeFuzzy(condition, labels) {
  if (labels.length) condition[FUZZY_KEY] = labels.join(',')
  else delete condition[FUZZY_KEY]
}

/** 摘掉一个字段 label(其余字段的顺序保持不变) */
function removeFuzzy(condition, label) {
  writeFuzzy(condition, parseFuzzy(condition).filter((l) => l !== label))
}

/**
 * 自由输入(未选候选):写值 + 标记。
 * 文本去前后空格(用户手打的片段,首尾空格无意义);文本为空 = 等同于 clearField(清空)。
 * @param {Object} condition 查询条件对象(原地修改)
 * @param {string} label 字段 label(= 条件键,中文数据键)
 * @param {string} text 用户输入片段
 * @returns {Object} 同一个 condition(便于链式/断言)
 */
export function applyFuzzy(condition, label, text) {
  if (!condition || !label) return condition
  const key = String(label).trim()
  const value = text === undefined || text === null ? '' : String(text).trim()
  if (!value) return clearField(condition, key)
  condition[key] = value
  const labels = parseFuzzy(condition).filter((l) => l !== key)
  labels.push(key)
  writeFuzzy(condition, labels)
  return condition
}

/**
 * 精确选中(候选下拉 / 参照弹窗):写编码 + 取消标记。
 * 编码**不去空格**:SQL Server char 列会带尾空格,那是数据事实(尾空格由后端 RTRIM 处理)。
 * 编码为空 ⇒ 等同清空(删条件值,标记照样摘掉)。
 * @returns {Object} 同一个 condition
 */
export function applyPicked(condition, label, code) {
  if (!condition || !label) return condition
  const key = String(label).trim()
  const value = code === undefined || code === null ? '' : String(code)
  if (value === '') delete condition[key]
  else condition[key] = value
  removeFuzzy(condition, key)
  return condition
}

/**
 * 片段命中的档案编码集合:condition[字段] = 编码数组(去重/trim/上限),并摘掉该字段的 `_fuzzy` 标记。
 * 数组语义 = 「这些档案之一」⇒ 后端拼 `列 IN (...)`,与精确选择同为"精确命中一组实体",不发 LIKE。
 * 集合为空 ⇒ 等同清空(别留一个空数组让后端拼 `IN ()` 报语法错)。
 * @param {Object} condition 查询条件对象(原地修改)
 * @param {string} label 字段 label(= 条件键)
 * @param {Array|string} codes 命中的编码集合(会被 normalizeCodeList 规范化)
 * @param {number} [max] 编码上限(默认 MAX_CODE_LIST)
 * @returns {Object} 同一个 condition
 */
export function applyCodes(condition, label, codes, max = MAX_CODE_LIST) {
  if (!condition || !label) return condition
  const key = String(label).trim()
  const list = normalizeCodeList(codes, max)
  if (!list.length) return clearField(condition, key)
  condition[key] = list
  removeFuzzy(condition, key)
  return condition
}

/**
 * 清空一个字段:删条件值 + 摘标记(其余字段的条件与标记都不动)。
 * @returns {Object} 同一个 condition
 */
export function clearField(condition, label) {
  if (!condition || !label) return condition
  const key = String(label).trim()
  delete condition[key]
  removeFuzzy(condition, key)
  return condition
}
