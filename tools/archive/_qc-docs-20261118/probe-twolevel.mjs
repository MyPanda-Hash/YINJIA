/**
 * probe-twolevel.mjs — 质量单据其余 6 张「同款改造 + 二级审批」端到端验收(2026-11-18)
 *
 * 用户口径:
 *   「质量单据列的其余表单都是一样的模式进行改动,二级审批实现即可,不需要指定某个审批人」
 *   + 追问确认「责任部门改成责任人所属部门(动态)」、只做「基础同款」
 *
 * 断言(全部对着 8090 真实接口,跑在**测试账套** YJ_TEST = HSDZ_MES_TEST):
 *   每张单:A1 建单/保存 → 责任部门 = 建单人所属部门(质量管理部)、单据日期 = 当天、
 *           编制格(填写人/编制人/责任人)= 建单人;
 *          A2 提交审批 → 审批中;一级(冯敏/质量审核)通过 → 待二级审批 + 审核人落值 + 批准格仍空;
 *              二级(冯总/超级管理员)批准 → 已审核 + 审批人落值;
 *   面板级:A3 编码列已不是参照(手输)、各章节日期绑单据日期、可附图片章节有附件字段。
 *
 * 用法:先起 8090(新 jar),再 `node tools/archive/_qc-docs-20261118/probe-twolevel.mjs`
 * 退出码 0 = 全过;任何 FAIL 退出码 1(不静默)。
 */
import { fetchRetry } from '../_apifetch.mjs'

const API = process.env.YJ_API || 'http://127.0.0.1:8090/api'
const PWD = process.env.YJ_PWD || '123456'
let pass = 0, fail = 0
const chk = (cond, msg, extra) => {
  if (cond) { pass++; console.log('    [PASS] ' + msg) }
  else { fail++; console.log('    [FAIL] ' + msg + (extra === undefined ? '' : ' → ' + JSON.stringify(extra))) }
}
const S = (v) => (v === null || v === undefined ? '' : String(v).trim())
const today = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10)

/** 质量单据(除紧急放行单 11-17 已验收):prep=编制格列, dept=责任部门列(空=该单不自动写) */
const PANELS = [
  { code: 'QC_BHG', prep: '填写人', dept: '', codeCol: '', attach: false, seed: { 异常描述: '探针:异常描述' } },
  { code: 'QC_BHC', prep: '责任人', dept: '责任部门', codeCol: '产品编码', attach: true, seed: { 问题描述: '探针:问题描述' } },
  { code: 'QC_BHZ', prep: '责任人', dept: '责任部门', codeCol: '物料编码', attach: true, seed: { 问题描述: '探针:问题描述' } },
  { code: 'QC_SCP', prep: '责任人', dept: '责任部门', codeCol: '物料编码', attach: true, seed: { 材料来源描述: '探针:材料来源' } },
  { code: 'QC_LYB', prep: '编制人', dept: '责任部门', codeCol: '物料编码', attach: true, seed: { 异常描述: '探针:异常描述' } },
  { code: 'QC_SCY', prep: '编制人', dept: '责任部门', codeCol: '产品/物料编码', attach: false, seed: { 异常描述: '探针:异常描述' } },
]

async function login(user) {
  const j = await (await fetchRetry(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ userName: user, password: PWD, factory: 'YJ_TEST' }),
  })).json()
  if (!(j.code === 0 || j.code === 200)) throw new Error(`${user} 登录失败: ${JSON.stringify(j).slice(0, 200)}`)
  return { token: j.data.token, realName: j.data.user?.realName || '', user }
}
const H = (s) => ({ 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + s.token })
const post = async (s, path, body) => (await fetchRetry(API + path, { method: 'POST', headers: H(s), body: JSON.stringify(body) })).json()
const get = async (s, path) => (await fetchRetry(API + path, { headers: H(s) })).json()
const ok = (j) => j.code === 0 || j.code === 200
const err = (j) => S(j?.message) || JSON.stringify(j).slice(0, 200)
const cb = (s, panelCode, buttonName, formData) =>
  post(s, '/px/callButton', { panelCode, buttonName, formData: formData || {}, buttonParam: {} })

async function readDoc(s, panelCode, no) {
  const j = await post(s, '/px/queryFormDataList', { panelCode, pageNo: 1, pageSize: 100 })
  if (!ok(j)) throw new Error('读单据失败: ' + err(j))
  const list = j.data?.list || j.list || []
  return list.find((r) => S(r['单据编号']) === no) || null
}

const zfy = await login('zfy')   // 钟芳云 · 质量检测 · 质量管理部 —— 建单/提交人
const fm = await login('fm')     // 冯敏 · 质量审核 —— 一级审批
const zjl = await login('zjl')   // 冯总 · 超级管理员 —— 二级批准
console.log(`[登录] 建单=${zfy.realName} 一级=${fm.realName} 二级=${zjl.realName}  今天=${today}\n`)

for (const P of PANELS) {
  console.log(`═══ ${P.code} ═══`)
  const cfg = await get(zfy, `/px/getPanelConfig?panelCode=${P.code}`)
  const fields = cfg?.dataSchema?.fields || cfg?.data?.dataSchema?.fields || []
  const fOf = (label) => fields.find((f) => (f.dataName || f.label || f.code) === label)
  if (P.codeCol) chk(!fOf(P.codeCol)?.refPanel, `${P.codeCol} 已不挂参照(责任人手动录入)`, fOf(P.codeCol))
  if (P.attach) chk(!!fOf('附件'), '「可附图片」章节的附件字段已登记')
  chk(fOf('单据日期')?.readonly === true, '单据日期 只读(日期自动生成)',
    fOf('单据日期') && { readonly: fOf('单据日期').readonly, editable: fOf('单据日期').editable })

  const mk = await cb(zfy, P.code, '新增流程', {})
  if (!ok(mk)) { chk(false, '新增流程 建单', err(mk)); console.log(''); continue }
  const no = S(mk.data?.['单据编号'] || mk.data?.编号)
  const save = await cb(zfy, P.code, '保存为草稿', { 编号: no, 单据编号: no, ...P.seed })
  chk(ok(save), '保存为草稿', err(save))

  let doc = await readDoc(zfy, P.code, no)
  chk(S(doc?.['单据日期']) === today, '单据日期 自动=当天', doc?.['单据日期'])
  if (P.dept) chk(S(doc?.['责任部门']) === '质量管理部', '责任部门 = 建单人所属部门(质量管理部)', doc?.['责任部门'])
  chk(S(doc?.[P.prep]) === zfy.realName, `编制格「${P.prep}」自动=建单人(钟芳云)`, doc?.[P.prep])

  const sub = await cb(zfy, P.code, '提交审批', { 编号: no, 单据编号: no })
  chk(ok(sub), '提交审批', err(sub))
  doc = await readDoc(zfy, P.code, no)
  chk(S(doc?.['单据状态']) === '审批中', '提交后状态=审批中', doc?.['单据状态'])

  const l1 = await cb(fm, P.code, '审批通过', { 编号: no, 单据编号: no, 审批意见: '一级:同意' })
  chk(ok(l1), '一级审批通过(冯敏)', err(l1))
  doc = await readDoc(fm, P.code, no)
  chk(S(doc?.['单据状态']) === '待二级审批', '一级通过 → 待二级审批', doc?.['单据状态'])
  chk(S(doc?.['审核人']) === fm.realName, '纸面「审核」= 冯敏', doc?.['审核人'])
  chk(S(doc?.['审批人']) === '', '二级未完成前「批准」格为空', doc?.['审批人'])

  const denied = await cb(fm, P.code, '审批通过', { 编号: no, 单据编号: no, 审批意见: '想直接批二级' })
  chk(!ok(denied), '二级节点非管理员被拒(仅超级管理员可批准)', err(denied))

  const l2 = await cb(zjl, P.code, '审批通过', { 编号: no, 单据编号: no, 审批意见: '批准' })
  chk(ok(l2), '二级批准通过(冯总)', err(l2))
  doc = await readDoc(zjl, P.code, no)
  chk(S(doc?.['单据状态']) === '已审核', '二级通过 → 已审核', doc?.['单据状态'])
  chk(S(doc?.['审批人']) === zjl.realName, '纸面「批准」= 冯总', doc?.['审批人'])
  console.log(`  单号 ${no}\n`)
}

console.log(`════ 结果: PASS ${pass} / FAIL ${fail} ════`)
process.exit(fail ? 1 : 0)
