/**
 * _probe-tcin-twolevel.cjs — 特采单(QC_TC_IN)两级审批 端到端验收(2026-10-04)
 *
 * 用户口径(逐条断言):
 *   ① 编制 = **提交审批的人**(提交那一刻后端自动写,只读);
 *   ② 「审核」= 一级审批通过的人 —— 谁能做一级:组织架构给该角色勾了「特采单·审核反审核」
 *      (yj_role_panel.perms 含 audit ⇒ can_approve='Y')的账号 ∪ 管理员;
 *   ③ 「批准」= **超级管理员**(yj_user.is_admin='Y');一级通过**不生成采购入库单**,
 *      批准通过才生成(生单钩子在二级);
 *   ④ 三格全自动只读:save 载荷带这三个键也一律被剥离;
 *   ⑤ 两级**各点一次**:一级通过后单据 = 待二级审批;非超级管理员在二级节点审批被拒;
 *   ⑥ 通知:提交→一级审批人;一级通过→超级管理员;批准通过→提交人 + 一级审核人;
 *      任一级驳回→提交人,二级驳回另通知一级审核人;
 *   ⑦ 任一级驳回 → 回草稿,审计字段清空;弃审同样清空;
 *   ⑧ 「审核」直审对特采单一律拒绝(取消直审)。
 *
 * 跑在**测试账套**(factory=test,HSDZ_MES_TEST):正式库只录真实业务,不给它塞测试单据。
 * 测试账套里给「研发审核」角色补 QC_TC_IN 的 audit 词(脚本内自行补,幂等),以构造
 * 「提交人 ≠ 一级审核人 ≠ 超级管理员」三个人真实分工。
 *
 * 用法:node tools/archive/_probe-tcin-twolevel.mjs
 */
import { createRequire } from 'node:module'
import { fetchRetry } from './_apifetch.mjs'

const API = process.env.YJ_API || 'http://127.0.0.1:8090/api'
const DB = 'HSDZ_MES_TEST'
let mssql
try { mssql = createRequire('D:/jdy-sync/package.json')('mssql') } catch (e) {
  console.error('缺少 mssql 模块(D:/jdy-sync):', e.message); process.exit(1)
}

let pass = 0, fail = 0
const ok = (m) => { pass++; console.log(`  [PASS] ${m}`) }
const ng = (m) => { fail++; console.log(`  [FAIL] ${m}`) }
const chk = (cond, m) => (cond ? ok(m) : ng(m))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const pool = await new mssql.ConnectionPool({
  server: '127.0.0.1', port: 1433, database: DB, user: 'yinjia', password: 'Yinjia@2026',
  options: { encrypt: false, trustServerCertificate: true },
}).connect()
const q = async (s) => (await new mssql.Request(pool).query(s)).recordset
const one = async (s) => (await q(s))[0] || null
const S = (v) => (v === null || v === undefined ? '' : String(v).trim())

// ── 前置:测试账套给「研发审核」角色补特采单 audit 词(构造真实的三角分工) ──
{
  const r = await one(`SELECT TOP 1 id FROM yj_role WHERE role_name = N'研发审核'`)
  if (!r) { console.error('测试账套缺少「研发审核」角色'); process.exit(1) }
  await q(`UPDATE yj_role_panel SET perms = CASE WHEN perms LIKE '%audit%' THEN perms ELSE perms + ',audit' END,
                  can_approve = 'Y' WHERE role_id = ${r.id} AND panel_code = 'QC_TC_IN'`)
  console.log(`[前置] 测试账套:研发审核 角色已获 QC_TC_IN 的 audit(审核反审核)词`)
}

async function login(user, pwd) {
  const res = await fetchRetry(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ userName: user, password: pwd, factory: 'YJ_TEST' }),
  })
  const j = await res.json()
  if (!(j.code === 0 || j.code === 200)) throw new Error(`${user} 登录失败: ${JSON.stringify(j).slice(0, 200)}`)
  return { token: j.data.token, realName: j.data.user?.realName || j.data.realName || '', user }
}
function client(sess) {
  const H = { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + sess.token }
  const post = async (url, body) => {
    const res = await fetchRetry(API + url, { method: 'POST', headers: H, body: JSON.stringify(body) })
    return res.json()
  }
  const cb = async (panel, button, formData) => {
    const j = await post('/px/callButton', { panelCode: panel, buttonName: button, formData: formData || {}, buttonParam: {} })
    return j
  }
  return { post, cb }
}
const okCall = (j) => j.code === 0 || j.code === 200
const errMsg = (j) => JSON.stringify(j).slice(0, 220)
/** callButton 的返回载荷是 {编号, 单据状态}(见 ButtonService.result) */
const resStatus = (j) => S(j?.data?.['单据状态'])
/** 库里真实状态(不信返回值,直接回查) */
const dbStatus = async (no) => {
  const r = await one(`SELECT ISNULL(pending,'') AS pending, ISNULL(shr,'') AS shr
                       FROM yj_doc_status WHERE panel_code='QC_TC_IN' AND doc_no=N'${no}'`)
  if (!r || !S(r.shr)) return '草稿'
  return '已审核'
}

const admin = await login('admin', '123456')          // 超级管理员(is_admin='Y')
const cp = await login('cp', '123456')                // 研发审核:一级审核人
const chai = await login('chaishanyin', '123456')     // 文件负责人:编制人/提交人(无 audit 词)
console.log(`[登录] admin=${admin.realName} cp=${cp.realName} chaishanyin=${chai.realName}`)

const A = client(admin), C = client(cp), H = client(chai)

/** 新建一张空白特采单草稿(不挂检验链 —— 本探针只验审批流,生单链路由 _tc-demo 覆盖) */
async function newDraft(tag) {
  const j = await A.cb('QC_TC_IN', '新增流程', { 单据日期: '2026-10-04', 产品名称: '两级审批探针' + tag })
  if (!okCall(j)) throw new Error('建单失败: ' + errMsg(j))
  const no = S(j.data['编号'])
  return no
}
const sign = async (no) => await one(
  `SELECT 编制人, 审核人, 审核时间, 审批人, 审批时间 FROM qc_tc_in WHERE 单据编号 = N'${no}'`)
const stat = async (no) => await one(
  `SELECT ISNULL(pending,'') AS pending, CAST(approve_node AS varchar(10)) AS approve_node,
          ISNULL(shr,'') AS shr, ISNULL(pending_by,'') AS pending_by
   FROM yj_doc_status WHERE panel_code = 'QC_TC_IN' AND doc_no = N'${no}'`)
const msgs = async (user, no) => await q(
  `SELECT 消息码 FROM yj_message WHERE 收件人 = N'${user}' AND 单据编号 = N'${no}' ORDER BY id`)

console.log('\n═══ A. 编制人 = 提交审批的人;提交/审批两权分离 ═══')
const dA = await newDraft('A')
{
  const s0 = await sign(dA)
  chk(!S(s0.编制人), `A1 新建草稿「编制人」为空(实际 "${S(s0.编制人)}")`)

  // 直审一律拒绝(取消直审)
  const ja = await A.cb('QC_TC_IN', '审核', { 编号: dA })
  chk(!okCall(ja) && /两级审批/.test(errMsg(ja)), `A2 超级管理员直审被拒:${errMsg(ja)}`)

  // save 载荷带编制人 → 被剥离(不能手改编制人)
  const jsave = await A.cb('QC_TC_IN', '保存', { 编号: dA, 编制人: '黑客', 产品名称: '两级审批探针A' })
  const sHack = await sign(dA)
  chk(okCall(jsave) && !S(sHack.编制人), `A3 保存载荷里的「编制人」被剥离(实际 "${S(sHack.编制人)}")`)

  // 无 audit 词的账号:审批通过被拒(权限闸门)
  const jDeny = await H.cb('QC_TC_IN', '审批通过', { 编号: dA })
  chk(!okCall(jDeny), `A4 无「审核反审核」权的账号审批被拒:${errMsg(jDeny)}`)

  // 无 audit 词但可提交(面板级覆盖 add/modify)
  const jSub = await H.cb('QC_TC_IN', '提交审批', { 编号: dA, 审批意见: '请审核' })
  chk(okCall(jSub), `A5 编制人(chaishanyin,无审核权)可提交审批:${okCall(jSub) ? resStatus(jSub) || 'OK' : errMsg(jSub)}`)
  const s1 = await sign(dA)
  chk(S(s1.编制人) === S(chai.realName || 'chaishanyin'), `A6 提交后「编制人」= 提交人 ${chai.realName}(实际 "${S(s1.编制人)}")`)
  const st1 = await stat(dA)
  chk(S(st1.pending) === 'Y' && S(st1.approve_node) === '1', `A7 状态=审批中(节点1):pending=${S(st1.pending)} node=${S(st1.approve_node)}`)
  const mCp = (await msgs('cp', dA)).map((x) => S(x.消息码))
  chk(mCp.includes('APPROVAL_SUBMITTED'), `A8 一级审批人(cp)收到提交通知:${mCp.join(',') || '(无)'}`)
}

console.log('\n═══ B. 一级审核通过 → 待二级审批(不生成采购入库单) ═══')
{
  const inBefore = await one(`SELECT COUNT(*) AS n FROM bd_purchase_in WHERE 单据编号 IN (
        SELECT target_form_no FROM form_flow_link WHERE source_panel_code='QC_TC_IN' AND source_form_no=N'${dA}')`)
  const j1 = await C.cb('QC_TC_IN', '审批通过', { 编号: dA, 审批意见: '一级:同意特采' })
  chk(okCall(j1), `B1 一级「审批通过」(cp,有审核反审核权)成功:${okCall(j1) ? resStatus(j1) : errMsg(j1)}`)
  const s2 = await sign(dA)
  chk(S(s2.审核人) === S(cp.realName || 'cp'), `B2 纸面「审核」= 一级审批通过的人 ${cp.realName}(实际 "${S(s2.审核人)}")`)
  chk(!!S(s2.审核时间), `B3 纸面「审核时间」已落值("${S(s2.审核时间)}")`)
  chk(!S(s2.审批人), `B4 纸面「批准」仍为空(一级不发批准):"${S(s2.审批人)}"`)
  const st2 = await stat(dA)
  chk(S(st2.pending) === 'Y' && S(st2.approve_node) === '2', `B5 状态=待二级审批(node=2):pending=${S(st2.pending)} node=${S(st2.approve_node)}`)
  const inAfter = await one(`SELECT COUNT(*) AS n FROM bd_purchase_in WHERE 单据编号 IN (
        SELECT target_form_no FROM form_flow_link WHERE source_panel_code='QC_TC_IN' AND source_form_no=N'${dA}')`)
  chk(Number(inAfter.n) === Number(inBefore.n), `B6 一级通过**不**生成采购入库单(link 命中 ${inAfter.n} 张)`)
  const mAdm = (await msgs('admin', dA)).map((x) => S(x.消息码))
  chk(mAdm.includes('APPROVAL_L2_PENDING'), `B7 超级管理员收到「待批准」通知:${mAdm.join(',') || '(无)'}`)
  const mChai = (await msgs('chaishanyin', dA)).map((x) => S(x.消息码))
  chk(!mChai.includes('APPROVAL_APPROVED'), `B8 一级通过**不**给提交人发「已通过」:${mChai.join(',') || '(无)'}`)

  // 二级节点:非超级管理员(有 audit 词的 cp)也不可批
  const jCp2 = await C.cb('QC_TC_IN', '审批通过', { 编号: dA })
  chk(!okCall(jCp2) && /超级管理员/.test(errMsg(jCp2)), `B9 二级节点非超级管理员审批被拒:${errMsg(jCp2)}`)
  const jCp2r = await C.cb('QC_TC_IN', '审批驳回', { 编号: dA, 审批意见: 'x' })
  chk(!okCall(jCp2r) && /超级管理员/.test(errMsg(jCp2r)), `B10 二级节点非超级管理员驳回被拒:${errMsg(jCp2r)}`)
}

console.log('\n═══ C. 超级管理员批准(二级) → 已审核 ═══')
{
  const j2 = await A.cb('QC_TC_IN', '审批通过', { 编号: dA, 审批意见: '批准:让步接收' })
  chk(okCall(j2), `C1 二级「批准通过」(超级管理员)成功:${okCall(j2) ? resStatus(j2) : errMsg(j2)}`)
  const s3 = await sign(dA)
  chk(S(s3.审批人) === S(admin.realName || 'admin'), `C2 纸面「批准」= 超级管理员 ${admin.realName}(实际 "${S(s3.审批人)}")`)
  chk(!!S(s3.审批时间), `C3 纸面「审批时间」已落值("${S(s3.审批时间)}")`)
  chk(S(s3.编制人) === S(chai.realName || 'chaishanyin') && S(s3.审核人) === S(cp.realName || 'cp'),
    `C4 三格各就各位:编制=${S(s3.编制人)} / 审核=${S(s3.审核人)} / 批准=${S(s3.审批人)}`)
  const st3 = await stat(dA)
  chk(S(st3.pending) === 'N' && S(st3.shr) === 'admin', `C5 状态=已审核(pending=N, shr=admin):pending=${S(st3.pending)} shr=${S(st3.shr)}`)
  const mChai2 = (await msgs('chaishanyin', dA)).map((x) => S(x.消息码))
  chk(mChai2.includes('APPROVAL_APPROVED'), `C6 提交人收到「已批准」通知:${mChai2.join(',') || '(无)'}`)
  const mCp2 = (await msgs('cp', dA)).map((x) => S(x.消息码))
  chk(mCp2.includes('APPROVAL_L2_DONE'), `C7 一级审核人收到「已被批准」通知:${mCp2.join(',') || '(无)'}`)

  // 审批留痕:一级 node=1 / 二级 node=2
  const hist = await q(`SELECT action, result, node_no, operator FROM yj_form_approval
                        WHERE panel_code='QC_TC_IN' AND form_no=N'${dA}' ORDER BY id`)
  const l1 = hist.find((x) => S(x.action) === 'APPROVE_L1')
  const l2 = hist.find((x) => S(x.action) === 'APPROVE' && Number(x.node_no) === 2)
  chk(!!l1 && Number(l1.node_no) === 1 && S(l1.operator) === 'cp', `C8 留痕 APPROVE_L1(node1, cp)`)
  chk(!!l2 && S(l2.operator) === 'admin', `C9 留痕 APPROVE(node2, admin)`)
}

console.log('\n═══ D. 弃审:回草稿 + 审核/批准两格清空 ═══')
{
  const ju = await A.cb('QC_TC_IN', '弃审', { 编号: dA, 审批意见: '撤回' })
  chk(okCall(ju), `D1 超级管理员弃审成功:${okCall(ju) ? resStatus(ju) : errMsg(ju)}`)
  const s4 = await sign(dA)
  chk(!S(s4.审核人) && !S(s4.审批人) && !S(s4.审核时间) && !S(s4.审批时间),
    `D2 弃审后审核/批准两格清空(审核="${S(s4.审核人)}" 批准="${S(s4.审批人)}")`)
  chk(S(s4.编制人) === S(chai.realName || 'chaishanyin'), `D3 弃审**保留**编制人("${S(s4.编制人)}")`)
  const st4 = await stat(dA)
  chk(S(st4.pending) === 'N' && !S(st4.shr), `D4 弃审后回草稿:${S(st4.shr) || '草稿'}`)
  // 重新提交 → 编制人按新的提交人刷新(admin 提交则为 系统管理员)
  const jre = await A.cb('QC_TC_IN', '提交审批', { 编号: dA })
  const s5 = await sign(dA)
  chk(okCall(jre) && S(s5.编制人) === S(admin.realName || 'admin'), `D5 重新提交后编制人刷新为提交人 ${admin.realName}(实际 "${S(s5.编制人)}")`)
  await A.cb('QC_TC_IN', '审批驳回', { 编号: dA, 审批意见: '清理' })
}

console.log('\n═══ E. 一级驳回 → 回草稿 + 通知提交人;二级驳回 → 另通知一级审核人 ═══')
{
  const dB = await newDraft('B')
  await H.cb('QC_TC_IN', '提交审批', { 编号: dB })
  const jr = await C.cb('QC_TC_IN', '审批驳回', { 编号: dB, 审批意见: '一级驳回:资料不全' })
  chk(okCall(jr) && resStatus(jr) === '草稿', `E1 一级驳回 → 草稿:${okCall(jr) ? resStatus(jr) : errMsg(jr)}`)
  const mB = (await msgs('chaishanyin', dB)).map((x) => S(x.消息码))
  chk(mB.includes('APPROVAL_REJECTED'), `E2 提交人收到驳回通知:${mB.join(',') || '(无)'}`)
  const sB = await sign(dB)
  chk(!S(sB.审核人) && !S(sB.审批人), `E3 一级驳回后审核/批准格均为空`)
  const noOpinion = await H.cb('QC_TC_IN', '提交审批', { 编号: dB })
  chk(okCall(noOpinion), `E4 驳回后可重新提交:${okCall(noOpinion) ? 'OK' : errMsg(noOpinion)}`)

  const jL1 = await C.cb('QC_TC_IN', '审批通过', { 编号: dB, 审批意见: '一级同意' })
  chk(okCall(jL1), `E5 重新提交后一级通过:${okCall(jL1) ? resStatus(jL1) : errMsg(jL1)}`)
  const jR2 = await A.cb('QC_TC_IN', '审批驳回', { 编号: dB, 审批意见: '批准驳回:不同意特采' })
  chk(okCall(jR2) && resStatus(jR2) === '草稿', `E6 二级驳回 → 草稿:${okCall(jR2) ? resStatus(jR2) : errMsg(jR2)}`)
  const mB2 = (await msgs('chaishanyin', dB)).map((x) => S(x.消息码))
  chk(mB2.filter((x) => x === 'APPROVAL_REJECTED').length >= 2, `E7 提交人再次收到驳回通知:${mB2.join(',')}`)
  const mCp3 = (await msgs('cp', dB)).map((x) => S(x.消息码))
  chk(mCp3.includes('APPROVAL_L2_REJECTED'), `E8 一级审核人收到「二级驳回」通知:${mCp3.join(',') || '(无)'}`)
  const sB2 = await sign(dB)
  chk(!S(sB2.审核人) && !S(sB2.审批人), `E9 二级驳回后审核/批准格均清空`)

  // 清理:探针单作废,别留在测试账套里像真单
  await A.cb('QC_TC_IN', '删除', { 编号: dB })
  await A.cb('QC_TC_IN', '删除', { 编号: dA })
}

console.log(`\n═══ 结果:${pass} PASS / ${fail} FAIL ═══`)
await pool.close()
process.exit(fail ? 1 : 0)
