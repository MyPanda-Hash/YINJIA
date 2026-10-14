/**
 * 「自动填充规格书」的失败口径(出货检验计划表 RD_INSP_PLAN ← 规格书 RD_SPEC_DOC)。
 *
 * 用户口径(2026-09-21):
 *   「出货检验计划表检验方法按规格书自动填充/带入,避免重复选择。
 *     必须得规格书已经填写提交审批完才可以在选择产品编码时自动填充带入。」
 * 即:规格书没走完提交审批(草稿/审批中/…)时,**一个格都不许自动带入** ——
 * 拿未定稿的检验方法去填出货检验计划,等于把没批准的检验口径发到产线。
 *
 * 门禁在后端(权威):/api/px/specByProduct 只挑「已审核/已归档」的规格书,
 * 没挑到就返回 found:false + reason:'not_approved' + 是哪一张、什么状态;
 * 本模块只负责把那个 payload 翻成界面要说的人话口径(纯函数,有单测)。
 *
 * @param {{found?: boolean, reason?: string, 规格书编号?: string, 规格书状态?: string}|null} payload 后端返回值
 * @returns {null | {kind: 'not_approved'|'no_spec', specNo: string, status: string}} null = 拿得到规格书
 */
export function specCarryFailure(payload) {
  const p = payload || {}
  if (p.found) return null
  if (p.reason === 'not_approved') {
    return {
      kind: 'not_approved',
      specNo: String(p['规格书编号'] ?? '').trim(),
      status: String(p['规格书状态'] ?? '').trim(),
    }
  }
  return { kind: 'no_spec', specNo: '', status: '' }
}

/* ── 跨面板复用(2026-10-13):组装工艺清单「组装BOM表」← 规格书「1.关键物料列表」──────
   用户口径:「组装工艺清单的 BOM 表也是可以导入对应规格书的 1.关键物料列表,这个是需要规格书
   已经填写完并且通过审批才会导入对应的规格书的数据…如果规格书没有通过审批归档导致数据不能
   导入时,可以弹窗提示『规格书未进行填写,请规格书通过审批之后再试,或者自行填写』,
   在还没有提交审批之前都是可以尝试导入规格书数据的。」

   于是同一套「按产品编号取规格书 + 审批门禁 + 整表替换」被两条链共用,差异全部落在
   autoFillSpec 配置上(不配 = 出厂口径 = 出货检验计划表那条**已验收通过**的链,一个字节都不变):
     · endpoint      —— 打哪个端点(权限按承载面板校验:RD_INSP_PLAN / RD_ASM_PROC);
     · specSheetArea —— 取规格书哪个表区('检验要求' / '物料清单');
     · notApprovedTip—— 未审批时的提示文案;
     · specDrift     —— 是否参与「规格书变动」比对(false = 该链的明细不是检验项目,比了只会误报)。
   下面三个纯函数就是这三处差异的唯一出口,组件不再自己拼 URL/文案(可单测)。 */

/** 出货检验计划表那条**已验收通过**的未审批提示(2026-09-21 用户口径)—— 缺省文案,不许改字 */
export const DEFAULT_NOT_APPROVED_TIP = '该产品的规格书 {no} 还没填写提交审批完（当前：{st}），暂不能自动带入 —— 请先在规格书里填好并走完提交审批'

/** 未审批提示的模板:面板配了 notApprovedTip 就用自己的措辞,否则用例(出货检验计划表) */
export function specNotApprovedTip(afs) {
  const t = String(afs?.notApprovedTip ?? '').trim()
  return t || DEFAULT_NOT_APPROVED_TIP
}

/**
 * 取规格书的请求(端点 + 查询参数)。
 * ⚠ 没配 specSheetArea 时**不带** sheetArea 参数 —— 出货检验计划表那条链的请求与改造前逐字相同
 *   (后端缺省取 '检验要求' 表区)。
 * @returns {{url: string, params: {code: string, sheetArea?: string}}}
 */
export function specCarryRequest(code, afs) {
  const url = String(afs?.endpoint ?? '').trim() || '/px/specByProduct'
  const params = { code: String(code ?? '').trim() }
  const area = String(afs?.specSheetArea ?? '').trim()
  if (area) params.sheetArea = area
  return { url, params }
}

/** 该链是否参与「规格书变动」比对(只有检验项目那类明细可比;显式 false 才关) */
export function specDriftEnabled(afs) {
  return afs?.specDrift !== false
}

/* ── 表头格 ← 规格书明细,按「检验项目」名匹配(2026-10-15,成型工艺清单 A4)──────────────
   用户口径:「成型工艺清单从规格书带出 4 项检验要求 —— 全从规格书取,按『检验项目』名匹配」:
     成型工艺清单 · 检验要求区   规格书明细 · 检验项目
       炭棒尺寸      ←            尺寸
       跌落强度      ←            跌落强度
       抗压强度      ←            抗压强度
       压降          ←            压降
   取值 = 规格书明细里 表区='检验要求' 且 检验项目 等于右列的那一行的 **检验要求**。

   ⚠ 与出货检验计划表那条链的差别:那边是「整表替换明细」,这里只写**表头格**、
     且**按名逐个匹配**。映射写在 autoFillSpec.headFromDetail(可配置),本函数只认配置不认面板。 */

/**
 * 规格书明细行 → 表头格的值。
 *
 * @param {{headFromDetail?: Array<{to: string, matchProject: string}>}|null} afs 「自动填充规格书」配置
 * @param {Array<Record<string, any>>|null} items 规格书明细行(键 = RD_SPEC_DOC 的字段 label)
 * @returns {Record<string, string>} **只含真取到的格**的 { 本面板字段label: 规格书检验要求 };
 *   某个 检验项目 在规格书里没有对应行(或那行 检验要求 为空)= **该键不出现** ——
 *   调用方按条目写 head 即可,没取到的那一格保持不动(不清空、也不写空串)。
 */
export function headFromSpecDetail(afs, items) {
  const out = {}
  const maps = afs?.headFromDetail
  if (!Array.isArray(maps) || !maps.length) return out
  const rows = Array.isArray(items) ? items : []
  for (const m of maps) {
    const to = String(m?.to ?? '').trim()
    const want = norm(m?.matchProject)
    if (!to || !want) continue
    // 匹配用 specDrift 同一条归一(去掉全部空白):「跌落 强度」这类排版差不算另一个检验项目
    const hit = rows.find((r) => norm(r?.['检验项目']) === want)
    const val = hit ? String(hit['检验要求'] ?? '').trim() : ''
    if (val) out[to] = val
  }
  return out
}

/**
 * 归一:去掉**所有**空白(含换行)。
 * 口径理由:检验要求/检验方法里的换行与空格是排版差异(「目视检查」写成「目视 检查」、
 * 「≤5 kPa」写成「≤5kPa」),工艺员不认为这是规格书变动;为它弹"规格书已变动"是假告警,
 * 会让提示失去可信度。反过来真改字(≤5→≤6、目视→仪器)仍然会被抓到。
 */
const norm = (v) => String(v ?? '').replace(/\s+/g, '')

/**
 * 出货检验计划表「当前内容」vs「规格书」的差异 —— 「规格书变动就提示」的判据。
 *
 * 用户口径(2026-09-21):「出货检验根据规格书进行录入,检验项根据规格书一致,能自动填入,
 *   规格书变动就提示当前出货检验进行提示。」
 * 实现口径:**只比内容,不比单号** —— 这样"同一张规格书改了内容"和"出了新版本规格书"两种情况
 * 都能提示到(系统里规格书改版本来就是新建一张单据 + 版本号,只比单号会漏)。
 * 对齐键 = 检验项目名(本单字段叫 控制项目,纸面都显示"检验项目");
 * 逐项比 检验要求 与 检验方法(本单 控制标准及要求 / 控制方法)。
 *
 * @param {Array<{检验项目?: string, 检验要求?: string, 检验方法?: string}>|null} specRows 规格书「检验要求」行
 * @param {Array<Record<string, any>>|null} planRows 本单明细行(键用本面板字段名)
 * @returns {{added: string[], removed: string[], changed: Array<{item: string, fields: string[]}>, drifted: boolean}}
 */
export function specDrift(specRows, planRows) {
  const empty = { added: [], removed: [], changed: [], drifted: false }
  const specs = (specRows || []).map((r) => ({ item: norm(r?.['检验项目']), req: norm(r?.['检验要求']), method: norm(r?.['检验方法']) })).filter((r) => r.item)
  const plans = (planRows || []).map((r) => ({ item: norm(r?.['控制项目']), req: norm(r?.['控制标准及要求']), method: norm(r?.['控制方法']) })).filter((r) => r.item)
  // 一边空:没有可比的内容(该走"没有可带入的规格书"那条提示,不在这里报"变动")
  if (!specs.length || !plans.length) return empty

  const specByItem = new Map(specs.map((r) => [r.item, r]))
  const planByItem = new Map(plans.map((r) => [r.item, r]))
  const added = specs.filter((r) => !planByItem.has(r.item)).map((r) => r.item)
  const removed = plans.filter((r) => !specByItem.has(r.item)).map((r) => r.item)
  const changed = []
  for (const s of specs) {
    const p = planByItem.get(s.item)
    if (!p) continue
    const fields = []
    if (s.req !== p.req) fields.push('检验要求')
    if (s.method !== p.method) fields.push('检验方法')
    if (fields.length) changed.push({ item: s.item, fields })
  }
  return { added, removed, changed, drifted: added.length + removed.length + changed.length > 0 }
}
