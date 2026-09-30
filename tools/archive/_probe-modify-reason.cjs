'use strict'
/**
 * _probe-modify-reason.cjs — 「申请修改」必填修改原因 的端到端验证(只在**测试账套**跑)
 *
 * 需求:《产品开发系统需求汇总.xlsx》sheet「数据记录表」第 2 条
 *   「修改:不需要反审核,只需填写修改原因」;用户口径「改完需要再审核」。
 *
 * 断言:
 *   ① 不带原因申请修改 → 被拒,文案 = 「请填写修改原因」(后端兜底,绕开界面也拦得住)
 *   ② 带原因申请修改 → 成功,且 yj_doc_status.modify_reason 落库
 *   ③ 管理员「修改审批通过」后 → yj_doc_modify_log.modify_reason 归档(历史快照,不被下次覆盖)
 *   ④ 「修改记录」接口返回的 records[].reason = 那句话
 *   ⑤ 闭环仍成立:审批通过后状态 = 修改中(即"改完还要再走审核再归档",闭环没被削弱)
 *
 * ⚠ 拿测试库 DEMO-PI-002(RD_PROD_INFO,已归档)演练,跑完把状态行/日志/审批留痕**全部还原**。
 *   正式库一行不动。
 */
const { execFileSync } = require('node:child_process')

const API = process.argv[2] || 'http://127.0.0.1:8090'
const PANEL = 'RD_PROD_INFO'
const DOC = 'DEMO-PI-002'
const REASON = '探针验证:本次要改产品名称与炭棒尺寸(跑完自动还原)'
let pass = 0, fail = 0
const check = (n, c, e) => { c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}${e ? '  → ' + e : ''}`)) }
const sql = (q) => execFileSync('sqlcmd', ['-S', 'localhost', '-d', 'HSDZ_MES_TEST', '-U', 'yinjia', '-P', 'Yinjia@2026',
  '-W', '-s', '\t', '-h', '-1', '-f', '65001', '-Q', `SET NOCOUNT ON; ${q}`], { encoding: 'utf8' }).trim()

async function main() {
  const lr = await (await fetch(`${API}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
  })).json()
  const token = lr?.data?.token
  if (!token) throw new Error('测试账套登录失败')
  const H = { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + token }
  const call = async (buttonName, formData) => (await (await fetch(`${API}/api/px/callButton`, {
    method: 'POST', headers: H, body: JSON.stringify({ panelCode: PANEL, buttonName, formData, buttonParam: {} }),
  })).json())

  // 备份原状态,便于 finally 还原
  const orig = sql(`SELECT ISNULL(modify_state,'-') + '|' + ISNULL(archived,'-') + '|' + ISNULL(shr,'-')
                     FROM yj_doc_status WHERE panel_code='${PANEL}' AND doc_no='${DOC}';`)

  try {
    // ① 不带原因 → 拒
    const r1 = await call('申请修改', { 编号: DOC })
    console.log(`\n① 不带原因: code=${r1?.code} msg=${JSON.stringify(r1?.message)}`)
    check('① 不带原因被拒', r1?.code !== 200 && r1?.code !== 0, JSON.stringify(r1).slice(0, 160))
    check('① 文案 = 请填写修改原因', String(r1?.message || '').includes('请填写修改原因'), String(r1?.message))

    // ② 带原因 → 成功 + 落库
    const r2 = await call('申请修改', { 编号: DOC, 修改原因: REASON })
    console.log(`② 带原因:   code=${r2?.code} data=${JSON.stringify(r2?.data)}`)
    check('② 带原因申请成功', r2?.code === 200 || r2?.code === 0, JSON.stringify(r2).slice(0, 160))
    const stored = sql(`SELECT ISNULL(modify_reason,'(null)') FROM yj_doc_status WHERE panel_code='${PANEL}' AND doc_no='${DOC}';`)
    check('② 原因已落 yj_doc_status.modify_reason', stored === REASON, stored.slice(0, 80))
    const st1 = sql(`SELECT ISNULL(modify_state,'-') FROM yj_doc_status WHERE panel_code='${PANEL}' AND doc_no='${DOC}';`)
    check('② 状态进入修改申请中(modify_state=R)', st1 === 'R', st1)

    // ③ 管理员审批通过 → 归档进修改记录
    const r3 = await call('修改审批通过', { 编号: DOC })
    console.log(`③ 修改审批通过: code=${r3?.code} data=${JSON.stringify(r3?.data)}`)
    check('③ 修改审批通过成功', r3?.code === 200 || r3?.code === 0, JSON.stringify(r3).slice(0, 160))
    const logged = sql(`SELECT TOP 1 ISNULL(modify_reason,'(null)') FROM yj_doc_modify_log WHERE panel_code='${PANEL}' AND doc_no='${DOC}' ORDER BY id DESC;`)
    check('③ 原因已归档到 yj_doc_modify_log.modify_reason', logged === REASON, logged.slice(0, 80))
    const st2 = sql(`SELECT ISNULL(modify_state,'-') FROM yj_doc_status WHERE panel_code='${PANEL}' AND doc_no='${DOC}';`)
    check('⑤ 闭环未削弱:审批通过后进入「修改中」(改完仍需再提交审核再归档)', st2 === 'Y', st2)

    // ④ 修改记录接口
    const r4 = await call('修改记录', { 编号: DOC })
    const rec = r4?.data?.records?.[0]
    console.log(`④ 修改记录: records[0].reason=${JSON.stringify(rec?.reason)}`)
    check('④ 修改记录返回 reason = 那句话', rec?.reason === REASON, JSON.stringify(rec?.reason))
  } finally {
    // 还原:状态行 / 修改日志 / 审批留痕(测试库的演示单,验完回到演练前的样子)
    try {
      sql(`UPDATE yj_doc_status SET modify_state=NULL, modify_req_by=NULL, modify_req_at=NULL,
                  modify_appr_by=NULL, modify_appr_at=NULL, modify_reason=NULL,
                  archived=CASE WHEN '${String(orig).split('|')[1]}' = '-' THEN archived ELSE '${String(orig).split('|')[1]}' END,
                  update_at=GETDATE()
            WHERE panel_code='${PANEL}' AND doc_no='${DOC}';`)
      sql(`DELETE FROM yj_doc_modify_log WHERE panel_code='${PANEL}' AND doc_no='${DOC}';`)
      sql(`DELETE FROM yj_form_approval WHERE panel_code='${PANEL}' AND form_no='${DOC}' AND action IN ('MODIFY_REQ','MODIFY_APPROVE');`)
      const after = sql(`SELECT ISNULL(modify_state,'-') + '|' + ISNULL(archived,'-') + '|' + ISNULL(modify_reason,'-') FROM yj_doc_status WHERE panel_code='${PANEL}' AND doc_no='${DOC}';`)
      console.log(`\n已还原状态行: ${after}(演练前 ${orig})`)
    } catch (e) { console.log('\n  ⚠ 还原失败: ' + e.message.split('\n')[0]) }
  }
  console.log(`\n═══ 结果: 通过 ${pass} / 失败 ${fail} ═══`)
  process.exit(fail ? 1 : 0)
}

main().catch((e) => { console.error('PROBE FAIL: ' + e.stack); process.exit(1) })
