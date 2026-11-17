/**
 * probe-twolevel.mjs — QC_JJF(紧急放行申请单)二级审批端到端验收(2026-11-17)
 *
 * 用户口径:
 *   「紧急放行通知这个单据需要完成的内容二级审批,其他内容按照图中填写的进行修改即可」
 *   「不需要指定人只需要实现二级审批即可」
 *
 * 断言(全部对着 8090 的真实接口,跑在**测试账套** YJ_TEST = HSDZ_MES_TEST):
 *   A1 建单/保存:物料编码按**手输文本**落库(不再走参照)、责任人/责任部门/单据日期 由系统自动生成
 *      (责任人 = 建单人姓名、责任部门 = 建单人所属部门、单据日期 = 当天);
 *   A2 面板元数据:检测结果 已下架、物料编码 data_type=文本;责任人/单据日期 只读(editable=0);
 *   A3 提交审批 → 审批中;一级审批人(fm 冯敏)通过 → **待二级审批**,纸面「审核人/审核时间」落值,
 *      「审批人」仍为空;
 *   A4 二级节点:非管理员(zfy/cmj)点「审批通过」被拒;管理员(zjl 冯总)通过 → **已审核**,
 *      纸面「审批人/审批时间」落值(编制=钟芳云 / 审核=冯敏 / 批准=冯总 三格齐全);
 *   A5 编制审批分离:提交人 zfy 本人不能做一级审批。
 *
 * 用法:先起 8090(新 jar),再 `node tools/archive/_jjf-20261117/probe-twolevel.mjs`
 * 退出码 0 = 全过;任何 FAIL 退出码 1(不静默)。
 */
import { fetchRetry } from '../_apifetch.mjs'

const API = process.env.YJ_API || 'http://127.0.0.1:8090/api'
const PWD = process.env.YJ_PWD || '123456'
let pass = 0, fail = 0
const chk = (cond, msg, extra) => {
  if (cond) { pass++; console.log('  [PASS] ' + msg) }
  else { fail++; console.log('  [FAIL] ' + msg + (extra === undefined ? '' : ' → ' + JSON.stringify(extra))) }
}
const S = (v) => (v === null || v === undefined ? '' : String(v).trim())

async function login(user) {
  const res = await fetchRetry(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ userName: user, password: PWD, factory: 'YJ_TEST' }),
  })
  const j = await res.json()
  if (!(j.code === 0 || j.code === 200)) throw new Error(`${user} 登录失败: ${JSON.stringify(j).slice(0, 200)}`)
  return { token: j.data.token, realName: j.data.user?.realName || '', user }
}
const H = (sess) => ({ 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + sess.token })
const post = async (sess, path, body) => (await fetchRetry(API + path, { method: 'POST', headers: H(sess), body: JSON.stringify(body) })).json()
const get = async (sess, path) => (await fetchRetry(API + path, { headers: H(sess) })).json()

const okCall = (j) => j.code === 0 || j.code === 200
const errOf = (j) => S(j?.message) || JSON.stringify(j).slice(0, 240)
const cb = (sess, buttonName, formData) =>
  post(sess, '/px/callButton', { panelCode: 'QC_JJF', buttonName, formData: formData || {}, buttonParam: {} })
/**
 * 读单据(列表接口取第 1 页再按单号定位)。
 * ⚠ 不用 condition 收窄:单据面板的通用列表**只支持按日期倒序翻页**,condition/keyword 传单号实测查不到
 *   (见 OtherSlipController 头注释 2026-11-16 的实测记录)。刚建的单必在第 1 页,直接按号找。
 */
async function readDoc(sess, no) {
  const j = await post(sess, '/px/queryFormDataList', { panelCode: 'QC_JJF', pageNo: 1, pageSize: 100 })
  if (!okCall(j)) throw new Error('读单据失败: ' + errOf(j))
  const list = j.data?.list || j.list || []
  return list.find((r) => S(r['单据编号']) === no) || null
}

const zfy = await login('zfy')   // 钟芳云 · 质量检测(质量管理部) —— 建单/提交人
const fm = await login('fm')     // 冯敏 · 质量审核 —— 一级审批
const cmj = await login('cmj')   // 车美晶 · 质量审核 —— 二级节点越权对照
const zjl = await login('zjl')   // 冯总 · 超级管理员 —— 二级批准
console.log(`[登录] 建单=${zfy.realName} 一级=${fm.realName} 二级=${zjl.realName}\n`)

/* ── A2 面板元数据(先查,后续断言用它兜底) ───────────────────── */
console.log('═══ A2 面板元数据 ═══')
const cfg = await get(zfy, '/px/getPanelConfig?panelCode=QC_JJF')
const fields = cfg?.dataSchema?.fields || cfg?.data?.dataSchema?.fields || []
const fOf = (label) => fields.find((f) => (f.dataName || f.label || f.code) === label)
chk(!fOf('检测结果'), '检测结果 字段已下架(纸面「三、检测结果」整行删除)', fOf('检测结果'))
chk(fOf('物料编码') && !fOf('物料编码').refPanel, '物料编码 不再挂参照(责任人手动录入)', fOf('物料编码'))
chk(fOf('责任部门'), '责任部门 字段已登记(右上信息表)', fOf('责任部门'))
chk(fOf('责任人') && fOf('责任人').readonly === true, '责任人 只读(自动生成填写人员)',
  fOf('责任人') && { readonly: fOf('责任人').readonly, editable: fOf('责任人').editable })
chk(fOf('单据日期') && fOf('单据日期').readonly === true, '单据日期 只读(自动生成时间)',
  fOf('单据日期') && { readonly: fOf('单据日期').readonly, editable: fOf('单据日期').editable })

/* ── A1 建单 + 保存 ─────────────────────────────────────────── */
console.log('\n═══ A1 建单 / 保存(手输物料编码 + 自动生成责任人/责任部门/日期) ═══')
const mk = await cb(zfy, '新增流程', {})
chk(okCall(mk), '新增流程 建单成功', errOf(mk))
const no = S(mk.data?.['单据编号'] || mk.data?.编号)
console.log('  单号:', no)
const save = await cb(zfy, '保存', {
  // ⚠ 按钮动作的定位键是「编号」(后端 requireNo 只认 formData.编号);只传「单据编号」会被当成
  //   新建 → 另开一张空单(实测踩到:每次跑建出 0001 空单 + 0002 有数据的单)。
  编号: no, 单据编号: no,
  物料类型: '外部来料',
  物料名称: '鑫恒炭粉',
  物料编码: 'JJF-TEST-0001',
  申请放行数量: 1000,
  批次号: '261112',
  紧急放行原因: '车间急用',
})
chk(okCall(save), '保存成功', errOf(save))
let doc = await readDoc(zfy, no)
console.log('  单据:', JSON.stringify({
  单据状态: doc?.['单据状态'], 责任人: doc?.['责任人'], 责任部门: doc?.['责任部门'],
  单据日期: doc?.['单据日期'], 物料编码: doc?.['物料编码'],
}))
chk(S(doc?.['物料编码']) === 'JJF-TEST-0001', '物料编码 手输文本原样落库(不再点选参照)', doc?.['物料编码'])
chk(S(doc?.['责任人']) === zfy.realName, `责任人 自动="建单人 ${zfy.realName}"`, doc?.['责任人'])
chk(S(doc?.['责任部门']) === '质量管理部', '责任部门 = 责任人所属部门(质量管理部)', doc?.['责任部门'])
chk(/^\d{4}-\d{2}-\d{2}$/.test(S(doc?.['单据日期'])), '单据日期 自动生成(yyyy-MM-dd)', doc?.['单据日期'])
chk(S(doc?.['单据状态']) === '草稿', '保存后状态=草稿', doc?.['单据状态'])

/* ── A5 编制审批分离 ───────────────────────────────────────── */
console.log('\n═══ A5 提交 + 编制审批分离 ═══')
const sub = await cb(zfy, '提交审批', { 编号: no, 单据编号: no })
chk(okCall(sub), '提交人 zfy 提交审批成功', errOf(sub))
doc = await readDoc(zfy, no)
chk(S(doc?.['单据状态']) === '审批中', '提交后状态=审批中', doc?.['单据状态'])
chk(S(doc?.['责任人']) === zfy.realName, '提交后「编制/责任人」仍=提交人', doc?.['责任人'])
const selfAudit = await cb(zfy, '审批通过', { 编号: no, 单据编号: no, 审批意见: '自审' })
chk(!okCall(selfAudit), '提交人不能自审(编制与审批分离)', errOf(selfAudit))

/* ── A3 一级审批 ───────────────────────────────────────────── */
console.log('\n═══ A3 一级审批(冯敏 质量审核) ═══')
const l1 = await cb(fm, '审批通过', { 编号: no, 单据编号: no, 审批意见: '部门意见已确认,同意放行' })
chk(okCall(l1), '一级审批通过', errOf(l1))
doc = await readDoc(fm, no)
console.log('  一级后:', JSON.stringify({ 单据状态: doc?.['单据状态'], 审核人: doc?.['审核人'], 审核时间: doc?.['审核时间'], 审批人: doc?.['审批人'] }))
chk(S(doc?.['单据状态']) === '待二级审批', '一级通过 → 待二级审批(不生单、不算已审核)', doc?.['单据状态'])
chk(S(doc?.['审核人']) === fm.realName, '纸面「审核」= 一级审批通过人(冯敏)', doc?.['审核人'])
chk(S(doc?.['审核时间']) !== '', '纸面「审核时间」已落值', doc?.['审核时间'])
chk(S(doc?.['审批人']) === '', '二级未完成前「批准」格为空', doc?.['审批人'])

/* ── A4 二级审批:越权 + 管理员批准 ─────────────────────────── */
console.log('\n═══ A4 二级审批(批准 = 冯总) ═══')
const l2Denied = await cb(cmj, '审批通过', { 编号: no, 单据编号: no, 审批意见: '我也批' })
chk(!okCall(l2Denied), '二级节点非管理员被拒(仅超级管理员可批准)', errOf(l2Denied))
const l2 = await cb(zjl, '审批通过', { 编号: no, 单据编号: no, 审批意见: '同意紧急放行' })
chk(okCall(l2), '二级批准通过(冯总)', errOf(l2))
doc = await readDoc(zjl, no)
console.log('  二级后:', JSON.stringify({ 单据状态: doc?.['单据状态'], 责任人: doc?.['责任人'], 审核人: doc?.['审核人'], 审批人: doc?.['审批人'], 审批时间: doc?.['审批时间'] }))
chk(S(doc?.['单据状态']) === '已审核', '二级通过 → 已审核', doc?.['单据状态'])
chk(S(doc?.['审批人']) === zjl.realName, '纸面「批准」= 二级通过人(冯总)', doc?.['审批人'])
chk(S(doc?.['审批时间']) !== '', '纸面「批准时间」已落值', doc?.['审批时间'])
chk(S(doc?.['审核人']) === fm.realName && S(doc?.['责任人']) === zfy.realName,
  '纸面三格齐全:编制=钟芳云 / 审核=冯敏 / 批准=冯总',
  { 编制: doc?.['责任人'], 审核: doc?.['审核人'], 批准: doc?.['审批人'] })

/* ── 留痕 ─────────────────────────────────────────────────── */
const hist = await cb(fm, '审批情况', { 编号: no, 单据编号: no })
if (okCall(hist)) {
  const rows = hist.data?.records || hist.data?.list || []
  const acts = rows.map((r) => S(r.action || r.动作))
  chk(acts.includes('SUBMIT') && acts.includes('APPROVE_L1'), '审批情况留痕含 SUBMIT / APPROVE_L1', acts)
  chk(acts.includes('APPROVE'), '审批情况留痕含二级 APPROVE', acts)
}

console.log(`\n════ 结果: PASS ${pass} / FAIL ${fail}   单号 ${no} ════`)
process.exit(fail ? 1 : 0)
