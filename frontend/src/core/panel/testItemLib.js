/**
 * 检验项目标准库:两个面板**各用各的库**——规格书(RD_SPEC_DOC)用 `spec.test`,
 * 出货检验计划表(RD_INSP_PLAN)用 `insp.plan`,**不共用、互不可见**
 * (2026-09-11「两面板共用同一批条目」的决定已撤销,本模块不再承担共用库的职责)。
 *
 * 本模块提供的是**两库共用的内容格式**(canonical `v=2`)与两个投影函数——
 * 两库的 JSON 形状本来就不同:
 *   · spec.test:item_code=组名,content={sub,req,method,basis}
 *   · insp.plan:item_code=表区名(必测项/型式检验),content=10 个中文键
 * 解析/保存一律先落到规范结构,再各自投影回自己那一侧的形态:
 *   toSpecSub() → 规格书子项 {name,req,method,basis}(组名由 group 承载)
 *   toInspRow() → 出货计划表行(10 个中文键)
 *
 * 历史旧格式(规格书 {sub,req,method,basis} / 出货计划 10 个中文键)**读取兼容**,
 * 用户「编辑 → 保存修改」时升级为 v2,所以旧数据同样可编辑。
 * **空字段一律留空串,不丢字段**:投影到不承载该字段的一侧是空列,而不是被删掉。
 */
export const CANONICAL_KEYS = [
  'v', 'group', 'name', 'req', 'method', 'basis',
  'quality', 'instrument', 'inspect', 'freq', 'content', 'measure', 'sampling',
]

/** 规范结构的当前版本:加字段/改映射时递增,便于迁移脚本判断是否需要转换 */
export const CANONICAL_VERSION = 2

/** 空的规范条目 */
export function emptyEntry() {
  return {
    v: CANONICAL_VERSION, group: '', name: '', req: '', method: '', basis: '',
    quality: '', instrument: '', inspect: '', freq: '', content: '', measure: '', sampling: '',
  }
}

export function isCanonical(o) {
  return !!o && typeof o === 'object' && !Array.isArray(o) && Number(o.v) === CANONICAL_VERSION
}

/** 旧规格书内容 {sub,req,method,basis} + item(组名) → 规范结构 */
function fromSpecLegacy(c, item) {
  return {
    ...emptyEntry(),
    group: str(item),
    name: str(c.sub),
    req: str(c.req),
    method: str(c.method),
    basis: str(c.basis),
  }
}

/** 旧出货计划内容(10 个中文键) + item(表区名) → 规范结构 */
function fromInspLegacy(c, item) {
  return {
    ...emptyEntry(),
    group: str(item),
    name: str(c['控制项目']),
    req: str(c['控制标准及要求']),
    method: str(c['控制方法']),
    quality: str(c['质量控制内容']),
    instrument: str(c['检测仪器']),
    inspect: str(c['检验']),
    measure: str(c['不合格应对措施']),
    freq: str(c['检测频率']),
    sampling: str(c['取样方式']),
    content: str(c['检验内容']),
  }
}

/**
 * 任意历史内容 → 规范结构(幂等;坏内容退化为空条目并把 group 记为 item,不抛异常)。
 * @param {string|object} content yj_std_lib.content(JSON 字符串或已解析对象)
 * @param {string} item item_code(旧库:规格书=组名,出货计划=表区名)
 */
export function toCanonical(content, item) {
  let c = content
  if (typeof c === 'string') {
    try { c = JSON.parse(c) } catch { c = null }
  }
  if (isCanonical(c)) return { ...emptyEntry(), ...c }
  if (!c || typeof c !== 'object' || Array.isArray(c)) return { ...emptyEntry(), group: str(item) }
  // 判据:出现出货计划专有中文键 → 按出货计划解析;否则按规格书解析
  const looksInsp = ['控制项目', '控制标准及要求', '控制方法', '质量控制内容'].some((k) => k in c)
  return looksInsp ? fromInspLegacy(c, item) : fromSpecLegacy(c, item)
}

/** 规范结构 → 规格书子项(组名不在这里,由调用方按 group 归组) */
export function toSpecSub(e) {
  return { name: str(e && e.name), req: str(e && e.req), method: str(e && e.method), basis: str(e && e.basis) }
}

/** 规范结构 → 出货计划表行(10 个中文键固定齐全,缺的就是空串) */
export function toInspRow(e) {
  return {
    控制项目: str(e && e.name),
    质量控制内容: str(e && e.quality),
    检测仪器: str(e && e.instrument),
    控制标准及要求: str(e && e.req),
    检验: str(e && e.inspect),
    不合格应对措施: str(e && e.measure),
    检测频率: str(e && e.freq),
    取样方式: str(e && e.sampling),
    检验内容: str(e && e.content),
    控制方法: str(e && e.method),
  }
}

/** 提交给 /stdlib/add|update 的 content(规范化 JSON 字符串) */
export function toContentJson(e) {
  return JSON.stringify({ ...emptyEntry(), ...e })
}

function str(v) {
  return v === undefined || v === null ? '' : String(v).trim()
}
