/**
 * spikeWaterTemplate.js —— 加标水「表格模版」的纯逻辑（可 node --test）
 *
 * 【用户口径 2026-11-06（第三轮）】
 *   「在标准库里面加上一个可以编辑模版的功能，现在的不行，可以让客户在页面进行一个模版自己设计，
 *    然后存进标准库里面，因为有很多种项目需要很多种表格，但是又不能一个一个写进去，
 *    只能是让客户自己能够操作去编辑模版，去查看品质管理里面的来料检验要求，这个里面有类似的操作」
 *
 * 【这一层为什么存在】模版=一套列定义，存 yj_std_lib.content（见 spikeWaterLayout.js）。
 *   UI 里"加一列/改列名/设分格"必须在**存库之前**就判死两类会悄悄丢数据的写法：
 *     ① 列的 key 不是已登记明细字段（改列名顺手改 key、手输一个不存在的列）⇒ 值存不进去；
 *     ② 两列绑同一个字段 / 同名显示 ⇒ 互相覆盖。
 *   这些判断放进纯函数，才能被 node:test 钉住（Vue 组件里的判断没人守得住）。
 *
 * 【两种列】
 *   · 已登记字段：key = 该字段在 yj_field 里的 label（后端按 label→列名映射落库），
 *     用户可另给一个显示名（label ≠ key 也安全：显示用 label，存值用 key）。
 *   · 自定义列：key = 用户起的名字，保存时先调 /px/extField/add 登记成动态字段
 *     （后端自动绑一个空闲「备用N」列）—— 所以保存前它带 pending:true，
 *     校验放行，但 layoutContent **不写** pending。
 */

import { parseLayout } from './spikeWaterLayout.js'

/** 新建/加列上限（用户口径「最多不超过 15 列」）。**存量原表不约束**（除铅真的是 17 列）。 */
export const MAX_COLS = 15
/** 「新增模版」生成的初始列数（用户口径「生成一个 6 列的表格」）。 */
export const TEMPLATE_COLS = 6

/**
 * 新模版首选 6 列：三种现有测试项目共有、且都已登记为明细字段 ⇒ 新模版一建就能存值。
 * ⚠ 「配水量」那个键里是**字面量反斜杠 + n**（历史表头就这么存的），不是换行 ——
 *   写成 '\n' 会拼出一个不存在的字段（spikeWaterTemplate.test.js 与 recordSheetConfigs 对钉）。
 */
export const PREFERRED_KEYS = [
  '测试日期', '项目名称', '测试装置', '测试工位', '配水量\\n（L）', '配置用水',
]

const str = (v) => (v === null || v === undefined ? '' : String(v).trim())
const widthOf = (f) => {
  const w = Number(f?.width)
  return w > 0 ? w : 90
}

/** 字段元数据 → 列定义（key = 字段 label，值按它落库） */
function colOf(field, group = '') {
  const label = str(field?.label)
  const col = { key: label, label, w: widthOf(field) }
  const g = str(group)
  if (g) col.group = g
  else col.rowspan = 2 // 无分格的列在表头占两行（与有分格的列对齐，见 spikeWaterLayout.parseLayout）
  return col
}

/** n 列空白（字段库读不到时的兜底：可编辑，但校验会拦住，不允许存一套存不了值的表） */
export function blankCols(n = TEMPLATE_COLS) {
  return Array.from({ length: Math.max(0, Number(n) || 0) }, (_, i) => ({
    key: '列' + (i + 1),
    label: '列' + (i + 1),
    w: 90,
    rowspan: 2,
  }))
}

/**
 * 新模版的初始列集：先按 PREFERRED_KEYS 取，字段池缺的用其余字段补齐，取满 n 列。
 * @param {Array<{label:string,dataType?:string,width?:number}>} pool 面板明细字段池
 * @param {number} n 列数（默认 6）
 */
export function baseTemplateCols(pool = [], n = TEMPLATE_COLS) {
  const list = (Array.isArray(pool) ? pool : []).filter((f) => str(f?.label))
  if (!list.length) return blankCols(n)
  const byLabel = new Map(list.map((f) => [str(f.label), f]))
  const picked = []
  for (const key of PREFERRED_KEYS) {
    if (picked.length >= n) break
    const f = byLabel.get(key)
    if (f) picked.push(f)
  }
  for (const f of list) {
    if (picked.length >= n) break
    if (!picked.includes(f)) picked.push(f)
  }
  return picked.slice(0, n).map((f) => colOf(f))
}

/** 还没被这套表用到的第一个字段（没有则 null） */
export function nextFreeField(pool = [], cols = []) {
  const used = new Set((Array.isArray(cols) ? cols : []).map((c) => str(c?.key)))
  return (Array.isArray(pool) ? pool : []).find((f) => str(f?.label) && !used.has(str(f.label))) || null
}

/** 追加一列（返回新数组，不改入参：对话框里取消要能回到原样） */
export function appendColumn(cols = [], field, group = '') {
  return [...(Array.isArray(cols) ? cols : []), colOf(field, group)]
}

/**
 * 保存前校验。
 * @param {Array} cols 编辑态的列（可带 pending:true / dataType，这些不落库）
 * @param {Array} pool 面板明细字段池（已登记字段的 label 集合）
 * @returns {{ok:boolean, errors:string[]}} errors 是给人看的中文句子（调用方 tt() 包一层）
 */
export function validateTemplate(cols = [], pool = []) {
  const list = Array.isArray(cols) ? cols : []
  if (!list.length) return { ok: false, errors: ['至少要有一列'] }
  const errors = []
  const bound = new Set((Array.isArray(pool) ? pool : []).map((f) => str(f?.label)).filter(Boolean))
  const seenKey = new Map()
  const seenLabel = new Map()
  list.forEach((c, i) => {
    const n = i + 1
    const key = str(c?.key)
    const label = str(c?.label)
    if (!label) errors.push(`第 ${n} 列的列名不能为空`)
    else if (label.length > 60) errors.push(`第 ${n} 列的列名过长（≤60 字）`)
    // pending = 本次要新建的自定义列：保存时先 /px/extField/add 登记，所以现在还没进字段池
    if (!key || !(c?.pending === true || bound.has(key))) {
      errors.push(`第 ${n} 列还没有绑定数据列（这一列的值存不进单据）`)
    }
    if (label) {
      if (seenLabel.has(label)) errors.push(`列名重复：「${label}」`)
      else seenLabel.set(label, n)
    }
    if (key) {
      if (seenKey.has(key)) errors.push(`数据列重复：「${key}」（两列抢同一列会互相覆盖）`)
      else seenKey.set(key, n)
    }
  })
  return { ok: errors.length === 0, errors }
}

/**
 * 编辑态列 → 标准库 content（与 parseLayout 的读取口径一致；不写 pending/dataType）。
 */
export function layoutContent(cols = []) {
  const out = (Array.isArray(cols) ? cols : []).map((c) => {
    const key = str(c?.key)
    const label = str(c?.label) || key
    const col = { key, label, w: Number(c?.w) > 0 ? Number(c.w) : 90 }
    const g = str(c?.group)
    if (g) col.group = g
    else col.rowspan = 2
    return col
  })
  return JSON.stringify({ cols: out }, null, 1)
}

/**
 * 模版摘要（标准库列表用）：列数 / 分格名。
 * 老式纯文本条目（历史库里有「NSF 42氯胺」这类只有名字的条目）明确判为**未设计**，
 * 不能拿「内置兜底 7 列」冒充它的列数。
 */
export function summarizeTemplate(content) {
  const p = parseLayout(content)
  if (!p.ok) return { ok: false, count: 0, groups: [], cols: [], reason: p.reason }
  const groups = []
  for (const c of p.cols) if (c.group && !groups.includes(c.group)) groups.push(c.group)
  return { ok: true, count: p.cols.length, groups, cols: p.cols, reason: '' }
}
