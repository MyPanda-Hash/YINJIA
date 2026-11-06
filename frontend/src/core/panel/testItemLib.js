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

/**
 * 规格书标准库「组序」——提交给 /stdlib/add|update 之外,渲染层也用它定组的先后。
 *
 * 用户口径 2026-11-06:「把研发管理的规格书·检验项目标准库里面的内容的排序按
 * 《测试项目汇总.xlsx》进行排序,现在有点乱,不好找对应的在哪里」。
 * 因此组序的真源改为 **`yj_std_lib.seq`**(迁移 tools/migrate-testlib-spec-order-20261106.sql
 * 按 Excel「序 号」列重编号:序号 n 的组 → seq 段 n*100,组内第 k 项 → n*100 + k*10);
 * 内置常量 SPEC_TEST_LIB 的既有次序**只作兜底**(未跑种子的空库 / 还没入库的组)。
 *
 * 排序键依次:① seq 升序(缺失或非法值排最后);② 常量里的位置(同 seq 时保持旧观感);
 * ③ 组名(完全不认识的组也不能互相抖动)。返回新数组,不改入参。
 *
 * @param {Array<{name: string, seq?: number|null}>} groups 已按库条目归好的组
 * @param {string[]} constOrder 内置常量里的组名次序(兜底)
 */
export function orderSpecGroups(groups, constOrder = []) {
  const posOf = (n) => {
    const i = constOrder.indexOf(n)
    return i < 0 ? Number.MAX_SAFE_INTEGER : i
  }
  const seqOf = (g) => {
    const n = Number(g && g.seq)
    return Number.isFinite(n) && n > 0 ? n : Number.MAX_SAFE_INTEGER
  }
  return [...(groups || [])].sort((a, b) =>
    (seqOf(a) - seqOf(b)) || (posOf(a && a.name) - posOf(b && b.name)) ||
    String((a && a.name) || '').localeCompare(String((b && b.name) || '')))
}

/**
 * 母项表(用户口径 2026-11-06 追加:「新增录进去不会变体归拢到一起,一个母项下的变体到处跑,
 * 都找不到,要根据组名来进行归拢」)。
 *
 * 母项 = 《测试项目汇总.xlsx》sheet「规格书检验项目汇总」的「序 号」1..26;`groups` 是归到该母项下的
 * **库组名写法**(同一项在生产库里可能有 1~3 种写法:尺寸/整体尺寸/*炭棒尺寸、余氯性能测试/*余氯去除性能、
 * 阻垢去除性能/阻垢去除性能测试/*阻垢去除率测试、*PFOA&PFOS去除性能测试/*PFOA/PFOS去除测试/…)。
 * 查表按**归一化名**匹配(去 `*`/`#`/空白、全角括号转半角),所以表里写不写星号都行。
 *
 * ⚠ 表里**没有**的组名一律独立成组、排在 26 项之后 —— 不做模糊猜测,避免把两项并错
 *   (实测字符相似度会把「*一级颗粒物去除率」判给「黑水及颗粒物测试」,把「浊度测试」判给「强度测试」)。
 *   新写法要归拢:把它加进对应母项的 groups 即可。
 */
export const SPEC_MOTHERS = [
  { no: 1, name: '外观', groups: ['外观', '*外观'] },
  { no: 2, name: '尺寸', groups: ['尺寸', '整体尺寸', '炭棒尺寸'] },
  { no: 3, name: '重量', groups: ['重量', '炭棒重量'] },
  { no: 4, name: '强度测试', groups: ['强度', '强度测试'] },
  { no: 5, name: '初始流速及压降测试', groups: ['初始流速及压降测试', '压降测试', '压降'] },
  { no: 6, name: '黑水及颗粒物测试', groups: ['黑水及颗粒物测试', '黑水测试（无需无黑）', '黑水及颗粒物测试 （无黑后）'] },
  { no: 7, name: '黄水测试', groups: ['黄水测试'] },
  { no: 8, name: '炭棒过滤精度测试', groups: ['炭棒过滤精度测试', '过滤精度测试', '一级颗粒物去除率', '炭棒浊度测试', '浊度测试'] },
  { no: 9, name: '隔夜浸泡口感/气味及浊度测试', groups: ['隔夜浸泡口感/气味', '隔夜浸泡口感/气味及浊度测试'] },
  { no: 10, name: '浸泡口感测试', groups: ['浸泡口感测试'] },
  { no: 11, name: '余氯性能测试', groups: ['余氯性能测试', '余氯去除性能'] },
  { no: 12, name: 'COD性能测试', groups: ['COD性能测试'] },
  { no: 13, name: '阻垢性能测试', groups: ['阻垢性能测试', '阻垢去除性能', '阻垢去除性能测试', '阻垢去除率测试'] },
  { no: 14, name: '抑菌性能测试', groups: ['抑菌性能测试'] },
  { no: 15, name: '过流杀菌性能测试', groups: ['过流杀菌性能测试'] },
  { no: 16, name: '碱性性能测试', groups: ['碱性性能测试'] },
  { no: 17, name: '矿化（富锶或微矿化）性能测试', groups: ['矿化（富锶或微矿化）性能测试', '矿化性能测试'] },
  { no: 18, name: 'VOC性能测试', groups: ['VOC性能测试'] },
  { no: 19, name: '除铅性能测试（PH8.5&6.5)', groups: ['除铅性能测试（PH8.5&6.5)'] },
  { no: 20, name: '除汞性能测试（PH8.5&6.5)', groups: ['除汞性能测试（PH8.5&6.5)'] },
  { no: 21, name: 'Cyst去除测试', groups: ['Cyst去除测试', 'Cyst去除性能测试'] },
  { no: 22, name: 'PFOA&PFOS去除性能测试', groups: ['PFOA&PFOS去除性能测试', 'PFOA/PFOS去除测试', 'PFOA&PFOS去除测试'] },
  { no: 23, name: 'NSF401（三组）去除性能测试', groups: ['NSF401（三组）去除性能测试', 'NSF401去除性能测试'] },
  { no: 24, name: '毒杀芬去除性能', groups: ['毒杀芬去除性能'] },
  { no: 25, name: 'MTBE去除性能', groups: ['MTBE去除性能'] },
  { no: 26, name: '卫生浸泡', groups: ['卫生浸泡', '卫生安全'] },
]

/** 组名归一化:去 `*`/`#`/空白,全角括号→半角(只用于查母项,不改显示名) */
export function normGroupName(name) {
  return String(name === undefined || name === null ? '' : name)
    .replace(/[*#＊＃\s]/g, '').replace(/（/g, '(').replace(/）/g, ')')
}

const MOTHER_INDEX = (() => {
  const m = new Map()
  for (const mother of SPEC_MOTHERS) {
    m.set(normGroupName(mother.name), mother)
    for (const g of mother.groups) m.set(normGroupName(g), mother)
  }
  return m
})()

/** 组名 → 母项(Excel 序 1..26);表里没有的返回 null(调用方按独立组处理) */
export function specMotherOf(groupName) {
  const k = normGroupName(groupName)
  return k ? (MOTHER_INDEX.get(k) || null) : null
}

/**
 * 按母项**归拢**并排序:同母项的变体并成一组(组名=母项名,行上带 `groupLabel`=原变体名),
 * 组序 = Excel 序号 1..26,表里没有的组排最后。返回新数组,不改入参。
 *
 * @param {Array<{name: string, seq?: number|null, subs?: Array<object>}>} groups 按库条目归好的组
 */
export function clusterSpecGroups(groups) {
  // 注意:这里 seq=0 **算有效值**(生产库有 12 组从没排过序),不能像 orderSpecGroups 那样当缺失 ——
  // 否则那批组会排到同母项变体的最后,把「母项在前、变体在后」的顺序打乱。
  const seqOf = (g) => {
    const n = Number(g && g.seq)
    return g && g.seq !== null && g.seq !== undefined && Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER
  }
  // 先按「组的 seq → 组名长度 → 组名」定变体先后(seq 并列时靠名字,保证稳定)
  const ordered = [...(groups || [])].sort((a, b) =>
    (seqOf(a) - seqOf(b)) ||
    String(a && a.name || '').length - String(b && b.name || '').length ||
    String(a && a.name || '').localeCompare(String(b && b.name || '')))
  const clusters = []
  for (const g of ordered) {
    const mother = specMotherOf(g && g.name)
    const key = mother ? 'm' + mother.no : 'x' + normGroupName(g && g.name)
    let c = clusters.find((x) => x.key === key)
    if (!c) {
      c = {
        key,
        name: mother ? mother.name : String((g && g.name) || ''),
        seq: null,
        motherNo: mother ? mother.no : Number.MAX_SAFE_INTEGER,
        at: clusters.length, // 未收录组保持调用方给的先后(通常是 seq 序),不在这里重排
        subs: [],
      }
      clusters.push(c)
    }
    const variant = String((g && g.name) || '')
    // 行上挂变体名:与母项同名(或就是母项)时不加前缀,免得每行都重复一遍组名
    const groupLabel = normGroupName(variant) === normGroupName(c.name) ? '' : variant.replace(/^[*#＊＃\s]+/, '')
    const seq = Number(g && g.seq)
    if (Number.isFinite(seq) && seq > 0 && (c.seq == null || seq < c.seq)) c.seq = seq
    for (const s of (g && g.subs) || []) c.subs.push({ ...s, groupLabel })
  }
  clusters.sort((a, b) => (a.motherNo - b.motherNo) || (a.at - b.at) || String(a.name).localeCompare(String(b.name)))
  return clusters.map((c) => ({ name: c.name, seq: c.seq, subs: c.subs }))
}

function str(v) {
  return v === undefined || v === null ? '' : String(v).trim()
}
