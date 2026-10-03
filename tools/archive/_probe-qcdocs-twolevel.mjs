/**
 * _probe-qcdocs-twolevel.mjs — 质量单据两级审批 端到端验收(2026-10-04)
 *
 * 覆盖**全部 8 张**(特采单 + 品质管理·质量单据 7 张 = 前端 qcSheetCfgs 全套):
 *   QC_TC_IN 特采单 / QC_BHG 不合格报告(制程) / QC_BHC 不合格品处理单(制程) /
 *   QC_BHZ 不合格品处理单(自制物料) / QC_JJF 紧急放行申请单 / QC_SCP 试产材料使用申请单 /
 *   QC_LYB 来料异常分析报告 / QC_SCY 生产异常分析报告
 *
 * 每张逐条断言(用户口径):
 *   ① 编制格 = **提交审批的人**(各表绑列不同,见 PREP),提交那一刻后端自动写;
 *   ② 三格全自动只读:save 载荷带这些键也一律被剥离;
 *   ③ 「审核」= 一级审批通过的人(组织架构勾了该面板「审核反审核」的角色账号);
 *   ④ 「批准」= **超级管理员**;一级通过 → 待二级审批(不生单、不发"已通过");
 *   ⑤ 两级**各点一次**:非超级管理员在二级节点审批/驳回被拒;
 *   ⑥ 直审(「审核」)对这些面板一律拒绝;
 *   ⑦ 通知:提交→一级审批人;一级通过→超级管理员;批准通过→提交人 + 一级审核人;
 *      任一级驳回→提交人,二级驳回另通知一级审核人;
 *   ⑧ 驳回/弃审 → 回草稿并清「审核/批准」两格,编制格保留。
 *
 * 跑在**测试账套**(factory=YJ_TEST → HSDZ_MES_TEST):正式库只录真实业务。
 * 用法:先起 8090,再 node tools/archive/_probe-qcdocs-twolevel.mjs [面板码...]
 */
import { createRequire } from 'node:module'
import { fetchRetry } from './_apifetch.mjs'

const API = process.env.YJ_API || 'http://127.0.0.1:8090/api'
const DB = 'HSDZ_MES_TEST'
let mssql
try { mssql = createRequire('D:/jdy-sync/package.json')('mssql') } catch (e) {
  console.error('缺少 mssql 模块(D:/jdy-sync):', e.message); process.exit(1)
}

/** 面板 → 表名(头表) */
const TABLE = {
  QC_TC_IN: 'qc_tc_in', QC_BHG: 'qc_bhg', QC_BHC: 'qc_bhc', QC_BHZ: 'qc_bhz',
  QC_JJF: 'qc_jjf', QC_SCP: 'qc_scp', QC_LYB: 'qc_lyb', QC_SCY: 'qc_scy',
}
/** 面板 → 纸面底部落款第一格「编制」绑的列(须与 ButtonService.QC_DOC_PREPARER 一致) */
const PREP = {
  QC_TC_IN: '编制人', QC_LYB: '编制人', QC_SCY: '编制人', QC_BHG: '填写人',
  QC_BHC: '责任人', QC_BHZ: '责任人', QC_JJF: '检测人', QC_SCP: '责任人',
}
const ALL = Object.keys(TABLE)
const PANELS = process.argv.slice(2).filter((a) => ALL.includes(a))
const LIST = PANELS.length ? PANELS : ALL

let pass = 0, fail = 0
const ok = () => { pass++ }
const ng = (m) => { fail++; console.log(`  [FAIL] ${m}`) }
const chk = (cond, m) => { if (cond) ok(); else ng(m) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const pool = await new mssql.ConnectionPool({
  server: '127.0.0.1', port: 1433, database: DB, user: 'yinjia', password: 'Yinjia@2026',
  options: { encrypt: false, trustServerCertificate: true },
}).connect()
const q = async (s) => (await new mssql.Request(pool).query(s)).recordset
const one = async (s) => (await q(s))[0] || null
const S = (v) => (v === null || v === undefined ? '' : String(v).trim())

// ── 前置:测试账套给「研发审核」角色补 8 张面板的 audit(审核反审核)词 ──
{
  const r = await one(`SELECT TOP 1 id FROM yj_role WHERE role_name = N'研发审核'`)
  if (!r) { console.error('测试账套缺少「研发审核」角色'); process.exit(1) }
  const inList = ALL.map((p) => `'${p}'`).join(',')
  await q(`UPDATE yj_role_panel SET perms = CASE WHEN perms LIKE '%audit%' THEN perms ELSE perms + ',audit' END,
                  can_approve = 'Y' WHERE role_id = ${r.id} AND panel_code IN (${inList})`)
  console.log(`[前置] 测试账套:研发审核 角色已获 ${ALL.length} 张质量单据的 audit(审核反审核)词`)
}

async function login(user, pwd) {
  const j = await (await fetchRetry(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ userName: user, password: pwd, factory: 'YJ_TEST' }),
  })).json()
  if (!(j.code === 0 || j.code === 200)) throw new Error(`${user} 登录失败: ${JSON.stringify(j).slice(0, 200)}`)
  return { token: j.data.token, realName: j.data.user?.realName || '', user }
}
const okCall = (j) => j.code === 0 || j.code === 200
const errMsg = (j) => JSON.stringify(j).slice(0, 200)
const resStatus = (j) => S(j?.data?.['单据状态'])

const admin = await login('admin', '123456')
const cp = await login('cp', '123456')
const chai = await login('chaishanyin', '123456')
const A = mk(admin), C = mk(cp), H = mk(chai)
function mk(sess) {
  const Hd = { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + sess.token }
  return {
    cb: async (panel, button, fd) =>
      (await (await fetchRetry(API + '/px/callButton', {
        method: 'POST', headers: Hd,
        body: JSON.stringify({ panelCode: panel, buttonName: button, formData: fd || {}, buttonParam: {} }),
      })).json()),
  }
}
console.log(`[登录] admin=${admin.realName} cp=${cp.realName} chaishanyin=${chai.realName}\n`)

const sign = async (panel, no) => await one(
  `SELECT ${PREP[panel]} AS prep, 审核人, 审核时间, 审批人, 审批时间 FROM ${TABLE[panel]} WHERE 单据编号 = N'${no}'`)
const stat = async (panel, no) => await one(
  `SELECT ISNULL(pending,'') AS pending, CAST(approve_node AS varchar(10)) AS approve_node, ISNULL(shr,'') AS shr
   FROM yj_doc_status WHERE panel_code = '${panel}' AND doc_no = N'${no}'`)
const msgs = async (user, no) => (await q(
  `SELECT 消息码 FROM yj_message WHERE 收件人 = N'${user}' AND 单据编号 = N'${no}' ORDER BY id`)).map((x) => S(x.消息码))

for (const P of LIST) {
  console.log(`═══ ${P}(${PREP[P]} = 编制格)═══`)
  const prep = PREP[P]
  let no = ''
  try {
    const mk1 = await A.cb(P, '新增流程', {})
    if (!okCall(mk1)) throw new Error('建单失败: ' + errMsg(mk1))
    no = S(mk1.data['编号'])

    // ① / ② 编制格:建单为空、save 载荷带值被剥离
    const s0 = await sign(P, no)
    chk(!S(s0.prep), `${P} A1 新建草稿「${prep}」(编制格)为空(实际 "${S(s0.prep)}")`)
    const jsave = await A.cb(P, '保存', { 编号: no, [prep]: '黑客', 审批人: '黑客' })
    const sHack = await sign(P, no)
    chk(okCall(jsave) && !S(sHack.prep) && !S(sHack.审批人),
      `${P} A2 保存载荷里的「${prep}」「审批人」被剥离(实际 "${S(sHack.prep)}" / "${S(sHack.审批人)}";保存返回 ${okCall(jsave) ? 'OK' : errMsg(jsave)})`)

    // ⑥ 直审拒绝
    const ja = await A.cb(P, '审核', { 编号: no })
    chk(!okCall(ja) && /两级审批/.test(errMsg(ja)), `${P} A3 直审(「审核」)被拒:${errMsg(ja)}`)

    // ③ 编制格 = 提交人;提交给一级审批人
    const jsub = await H.cb(P, '提交审批', { 编号: no })
    chk(okCall(jsub), `${P} A4 编制人(chaishanyin,无审核权)可提交审批:${okCall(jsub) ? resStatus(jsub) : errMsg(jsub)}`)
    const s1 = await sign(P, no)
    chk(S(s1.prep) === S(chai.realName || 'chaishanyin'),
      `${P} A5 提交后「${prep}」= 提交人 ${chai.realName}(实际 "${S(s1.prep)}")`)
    const st1 = await stat(P, no)
    chk(S(st1.pending) === 'Y' && S(st1.approve_node) === '1', `${P} A6 状态=审批中(节点1)`)
    chk((await msgs('cp', no)).includes('APPROVAL_SUBMITTED'), `${P} A7 一级审批人(cp)收到提交通知`)

    // 无审核权的账号审批被拒
    const jDeny = await H.cb(P, '审批通过', { 编号: no })
    chk(!okCall(jDeny), `${P} A8 无「审核反审核」权的账号审批被拒`)

    // ③④ 一级通过 → 待二级审批(审核格落名、批准格仍空、不生单)
    const j1 = await C.cb(P, '审批通过', { 编号: no, 审批意见: '一级:同意' })
    chk(okCall(j1), `${P} B1 一级「审批通过」(cp)成功:${okCall(j1) ? resStatus(j1) : errMsg(j1)}`)
    const s2 = await sign(P, no)
    chk(S(s2.审核人) === S(cp.realName || 'cp'), `${P} B2 纸面「审核」= 一级审核人 ${cp.realName}(实际 "${S(s2.审核人)}")`)
    chk(!!S(s2.审核时间) && !S(s2.审批人), `${P} B3 审核时间已落、批准格仍空`)
    const st2 = await stat(P, no)
    chk(S(st2.approve_node) === '2' && S(st2.pending) === 'Y', `${P} B4 状态=待二级审批(node=2)`)
    chk((await msgs('admin', no)).includes('APPROVAL_L2_PENDING'), `${P} B5 超级管理员收到「待批准」通知`)
    chk(!(await msgs('chaishanyin', no)).includes('APPROVAL_APPROVED'), `${P} B6 一级通过不给提交人发「已通过」`)

    // ⑤ 二级节点:非超级管理员不可批/不可驳
    const jCp2 = await C.cb(P, '审批通过', { 编号: no })
    chk(!okCall(jCp2) && /超级管理员/.test(errMsg(jCp2)), `${P} B7 二级节点非超级管理员审批被拒`)
    const jCp2r = await C.cb(P, '审批驳回', { 编号: no, 审批意见: 'x' })
    chk(!okCall(jCp2r) && /超级管理员/.test(errMsg(jCp2r)), `${P} B8 二级节点非超级管理员驳回被拒`)

    // ④⑦ 超级管理员批准 → 已审核 + 通知两端
    const j2 = await A.cb(P, '审批通过', { 编号: no, 审批意见: '批准:同意' })
    chk(okCall(j2), `${P} C1 二级「批准通过」(超级管理员)成功:${okCall(j2) ? resStatus(j2) : errMsg(j2)}`)
    const s3 = await sign(P, no)
    chk(S(s3.审批人) === S(admin.realName || 'admin'), `${P} C2 纸面「批准」= 超级管理员 ${admin.realName}(实际 "${S(s3.审批人)}")`)
    const st3 = await stat(P, no)
    chk(S(st3.pending) === 'N' && S(st3.shr) === 'admin', `${P} C3 状态=已审核(pending=N, shr=admin)`)
    chk((await msgs('chaishanyin', no)).includes('APPROVAL_APPROVED'), `${P} C4 提交人收到「已批准」通知`)
    chk((await msgs('cp', no)).includes('APPROVAL_L2_DONE'), `${P} C5 一级审核人收到「已被批准」通知`)
    const hist = await q(`SELECT action, node_no FROM yj_form_approval WHERE panel_code='${P}' AND form_no=N'${no}' ORDER BY id`)
    chk(hist.some((x) => S(x.action) === 'APPROVE_L1' && Number(x.node_no) === 1)
      && hist.some((x) => S(x.action) === 'APPROVE' && Number(x.node_no) === 2), `${P} C6 留痕 node1 + node2 齐备`)

    // ⑧ 弃审 → 回草稿 + 清两格 + 保留编制格
    const ju = await A.cb(P, '弃审', { 编号: no })
    chk(okCall(ju), `${P} D1 弃审成功:${okCall(ju) ? resStatus(ju) : errMsg(ju)}`)
    const s4 = await sign(P, no)
    chk(!S(s4.审核人) && !S(s4.审批人) && !S(s4.审核时间) && !S(s4.审批时间), `${P} D2 弃审后审核/批准两格清空`)
    chk(S(s4.prep) === S(chai.realName || 'chaishanyin'), `${P} D3 弃审保留编制格("${S(s4.prep)}")`)

    // ⑦⑧ 驳回:一级驳回 → 提交人收通知;二级驳回 → 另通知一级审核人
    await H.cb(P, '提交审批', { 编号: no })
    const jr1 = await C.cb(P, '审批驳回', { 编号: no, 审批意见: '一级驳回:资料不全' })
    chk(okCall(jr1) && resStatus(jr1) === '草稿', `${P} E1 一级驳回 → 草稿`)
    chk((await msgs('chaishanyin', no)).includes('APPROVAL_REJECTED'), `${P} E2 提交人收到驳回通知`)
    await H.cb(P, '提交审批', { 编号: no })
    await C.cb(P, '审批通过', { 编号: no })
    const jr2 = await A.cb(P, '审批驳回', { 编号: no, 审批意见: '批准驳回:不同意' })
    chk(okCall(jr2) && resStatus(jr2) === '草稿', `${P} E3 二级驳回 → 草稿`)
    chk((await msgs('cp', no)).includes('APPROVAL_L2_REJECTED'), `${P} E4 一级审核人收到「二级驳回」通知`)
    const s5 = await sign(P, no)
    chk(!S(s5.审核人) && !S(s5.审批人), `${P} E5 二级驳回后审核/批准格清空`)
    console.log(`   └ 21 项断言完成`)
  } catch (e) {
    ng(`${P} 探针异常: ${e.message}`)
  } finally {
    if (no) {
      const st = await stat(P, no)
      if (S(st.pending) === 'Y') await A.cb(P, '审批驳回', { 编号: no, 审批意见: '探针清理' })
      else if (S(st.shr)) await A.cb(P, '弃审', { 编号: no, 审批意见: '探针清理' })
      const del = await A.cb(P, '删除', { 编号: no })
      console.log(`   └ 清理 ${no}: ${okCall(del) ? '已作废' : errMsg(del)}\n`)
      await sleep(200)
    }
  }
}

console.log(`═══ 结果:${pass} PASS / ${fail} FAIL ═══`)
await pool.close()
process.exit(fail ? 1 : 0)
