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
