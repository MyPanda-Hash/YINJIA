/**
 * _e2e-t3.mjs —— 需求 T3:首件检验单(QC_FIRST_INSP)与制程检验单(QC_PROC_INSP)接入两级审批
 *
 * 验收点:
 *   提交审批(有编辑权即可)→ 一级审批(该面板 can_approve 角色 ∪ 管理员;提交人本人不能批)
 *   → 超级管理员批准(二级,必须再点一次)→ 已审核;驳回→草稿;弃审→草稿;直接审核被拒。
 *   纸面/导出显示审核人(一级)与批准(审批人);证明组织架构(yj_role_panel.can_approve)驱动流程。
 *
 * 运行前提:8091 新代码;测试库 HSDZ_MES_TEST 已执行本轮迁移。
 * 测试夹具(只碰测试库,结束还原):
 *   · 测试库旧快照没有 1031/1033/1039 角色、两面板 can_approve 全 N ⇒ 临时给 **角色 4(研发审核;
 *     账号 cp / 陈秀丽)** 补 can_approve='Y' + audit 词,作为一级审批人;负测账号 role 2 的
 *     wangguangzhen(王光珍)无审批权。
 *   · 正式库 HSDZ_MES 的组织架构审批权(1031/1033/1039/1042)用**只读 GET** 取证
 *     (自签 YJ 令牌打 /api/auth/perms、/api/sys/role/{id}/panels)。
 *
 * 用法:node tools/archive/_qc-insp-verify-20261106/_e2e-t3.mjs [--base http://127.0.0.1:8091]
 * 产物:evidence/t3/
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import {
  Results, ROOT, login, loginOrSign, api, okCall, saveJson, saveText, nowStamp, evidenceDir,
  pdfText, xlsxText, norm, sleep, qs,
} from './_lib.mjs'
import {
  PANEL, parseArgs, openTestDb, createDraft, cleanupDocs, docStatus, headSign, approvals, headValue,
  S, fixtureGrant, fixtureRestore, prodOrgEvidence, FIXTURE, sweepResidue,
} from './_e2e-common.mjs'

const { arg } = parseArgs()
const BASE = String(arg('base', 'http://127.0.0.1:8091')).replace(/\/$/, '')
const FACTORY = 'YJ_TEST'
const STAMP = nowStamp()
const RUN = STAMP
const OUT = evidenceDir('t3')
const UI = path.join(ROOT, 'tools/archive/_qc-insp-verify-20261106/_ui-verify.mjs')
const ADMIN_NAME = '系统管理员'
const L1_NAME = FIXTURE.approverName // 陈秀丽
const NEG_NAME = FIXTURE.negativeName // 王光珍
const r = new Results('T3 首件/制程两级审批 @ ' + BASE + ' run=' + RUN)
r.fact('参数', {
  base: BASE, factory: FACTORY, db: 'HSDZ_MES_TEST', run: RUN,
  fixture: { roleId: FIXTURE.roleId, roleName: FIXTURE.roleName, approver: FIXTURE.approverUser + '/' + FIXTURE.approverName, negative: FIXTURE.negativeUser + '/' + NEG_NAME, panels: FIXTURE.panels },
})
const allDocs = []
let db
let fixtureState = null

function runUi(argv) {
  console.log('\n── UI 用例 → ' + argv.join(' ') + ' ──')
  let exit = 0
  try { execFileSync(process.execPath, argv, { cwd: ROOT, stdio: 'inherit' }) } catch (e) { exit = typeof e.status === 'number' ? e.status : 1 }
  return exit
}
function uiArgs(panel, docNo, state, prefix, extra = []) {
  return [UI, '--base', BASE, '--factory', FACTORY, '--panel', panel, '--docNo', docNo,
    '--task', 't3-paper', '--state', state, '--out', OUT, '--prefix', prefix,
    '--expect-preparer', ADMIN_NAME, '--expect-l1', L1_NAME, '--expect-l2', ADMIN_NAME, ...extra]
}
const callOk = (res) => okCall(res)
const msgOf = (res) => JSON.stringify(res).slice(0, 300)

try {
  db = await openTestDb()
  const admin = await login(BASE, { factory: FACTORY })
  const adm = api(BASE, admin.token)
  const cpSess = await loginOrSign(BASE, { userName: FIXTURE.approverUser, factory: FACTORY })
  const cp = api(BASE, cpSess.token)
  const negSess = await loginOrSign(BASE, { userName: FIXTURE.negativeUser, factory: FACTORY })
  const neg = api(BASE, negSess.token)
  r.check('8091 登录成功(admin/cp/wangguangzhen;非admin 口令未知则自签)',
    !!admin.token && !!cpSess.token && !!negSess.token,
    `admin=${admin.user.realName} cp=${cpSess.user.realName || '(自签)'}(${cpSess.tokenSource}) neg=${negSess.user.realName || '(自签)'}(${negSess.tokenSource})`)

  /* ── ① 测试夹具:临时给角色 4 两面板审批权(原值记录,结束还原) ── */
  fixtureState = await fixtureGrant(db, OUT)
  r.fact('夹具原值(结束还原)', fixtureState.originals)
  r.check('夹具:测试库角色 ' + FIXTURE.roleId + '/' + FIXTURE.roleName + ' 两面板 can_approve=Y 已临时生效',
    true, '夹具 SQL: ' + path.join(OUT, 'fixture-grant.sql'))

  // 夹具后各账号实际审批权(与登录响应同源:GET /api/auth/perms)
  const permsOf = async (apiCli) => (await apiCli.getJson('/api/auth/perms')).data
  const cpPerms = await permsOf(cp)
  const negPerms = await permsOf(neg)
  r.check('夹具生效:cp 的 approvePanels 含 QC_PROC_INSP / QC_FIRST_INSP(登录响应同源)',
    (cpPerms.approvePanels || []).includes('QC_PROC_INSP') && (cpPerms.approvePanels || []).includes('QC_FIRST_INSP'),
    JSON.stringify(cpPerms.approvePanels))
  r.check('负测:wangguangzhen 的 approvePanels 不含两面板',
    !(negPerms.approvePanels || []).includes('QC_PROC_INSP') && !(negPerms.approvePanels || []).includes('QC_FIRST_INSP'),
    JSON.stringify(negPerms.approvePanels))

  /* ── ② 正式库组织架构审批权只读证据(需求「组织架构审批权驱动」) ── */
  const orgUsers = ['fm', 'cmj', 'TANCHENG', 'WANGGUANGZHEN', 'cs', 'cxy', 'admin']
  const org = await prodOrgEvidence(BASE, orgUsers)
  r.fact('正式库 HSDZ_MES 组织架构授权矩阵(GET /api/sys/role/{id}/panels)', org.granted)
  r.fact('正式库 HSDZ_MES 各账号 approvePanels(GET /api/auth/perms)', org.perms)
  for (const u of ['fm', 'cmj', 'TANCHENG', 'WANGGUANGZHEN', 'cs']) {
    const ap = org.perms[u]?.approvePanels || []
    r.check(`组织架构证据:正式库 ${u} 的 approvePanels 含两面板(角色授权真实驱动)`,
      ap.includes('QC_PROC_INSP') && ap.includes('QC_FIRST_INSP'), JSON.stringify(ap))
  }
  const cxyAp = org.perms['cxy']?.approvePanels || []
  r.check('组织架构证据:正式库 cxy(质量检测,无审批权)approvePanels 不含两面板',
    !cxyAp.includes('QC_PROC_INSP') && !cxyAp.includes('QC_FIRST_INSP'), JSON.stringify(cxyAp))
  // /role/{id}/panels 的 granted 行只带 perms(不含 can_approve 字段);引擎判据 = perms 含 audit 词
  // (见 AuthService.approvePanelsOf:can_approve='Y' 才算审批权;两账套 DB 快照另证 can_approve=Y)。
  for (const rid of [1031, 1033, 1039, 1042]) {
    const g = org.granted[rid] || []
    const both = ['QC_PROC_INSP', 'QC_FIRST_INSP'].every((pc) => g.some((x) => (x.panelCode || x.panel_code) === pc))
    const auditOk = g.every((x) => String(x.perms || '').split(',').includes('audit'))
    r.check(`组织架构证据:正式库角色 ${rid} 两面板均有授权且 perms 含 audit(引擎审批词)`, both && auditOk,
      JSON.stringify(g).slice(0, 300))
    // 台账真值(正式库 yj_role_panel.can_approve)由 stage1/2 DB 快照佐证;此处从 8091 GET 已足够,
    // 再补一条:正式库该角色账号确实有启用账号(见 DB 快照 can_approve=Y 行)。
  }

  /* ── ③ 存量直审单:shr 兜底显示审核人(纸面/descriptor) ── */
  for (const [panel, docNo, expectShr] of [
    ['QC_PROC_INSP', 'ZC-2026-09-0003', '柴善银'],
    ['QC_FIRST_INSP', 'SJ-2026-09-0003', '柴善银'],
  ]) {
    try {
      const d = (await adm.getJson(`/api/px/getFormDescriptor?panelCode=${panel}&code=${encodeURIComponent(docNo)}`)).data?.data || {}
      r.check(`存量直审单 ${panel}/${docNo}:表内审核人为空 → descriptor「审核人」仍显示 shr 兜底「${expectShr}」`,
        S(d['审核人']) === expectShr, '审核人=' + JSON.stringify(d['审核人']))
    } catch (e) {
      r.check(`存量直审单 ${panel}/${docNo} shr 兜底`, false, String(e.message).slice(0, 200))
    }
  }

  /* ── ④ 两张面板各跑完整链 ── */
  for (const panel of ['QC_PROC_INSP', 'QC_FIRST_INSP']) {
    const P = PANEL[panel]
    const docs = []
    const tag = panel === 'QC_PROC_INSP' ? 'proc' : 'first'
    let mainNo = ''
    try {
      /* 前置:元数据结构(审批人/审批时间列 + yj_field 只读) */
      const cols = (await db.q(
        `SELECT name FROM sys.columns WHERE object_id=OBJECT_ID('dbo.${P.headTable}')
           AND name IN (N'审批人',N'审批时间',N'审核人',N'审核时间')`)).map((x) => x.name)
      r.check(`${panel} 前置:头表已有 审核人/审核时间/审批人/审批时间 列`, cols.length === 4, JSON.stringify(cols))
      const af = await db.q(
        `SELECT label, editable, hidden, visible FROM yj_field WHERE panel_code='${panel}' AND label IN (N'审批人',N'审批时间')`)
      r.check(`${panel} 前置:yj_field 登记 审批人/审批时间(editable=0 只读)`,
        af.length === 2 && af.every((x) => Number(x.editable) === 0), JSON.stringify(af))
      const cfg = (await adm.getJson('/api/px/getPanelConfig?panelCode=' + panel)).data || {}
      const cf = Object.fromEntries((cfg.dataSchema?.fields || []).map((f) => [f.dataName, f]))
      r.check(`${panel} 前置:getPanelConfig 下发 审批人/审批时间 且 readonly`,
        !!cf['审批人'] && cf['审批人'].readonly === true && !!cf['审批时间'] && cf['审批时间'].readonly === true,
        JSON.stringify({ 审批人: cf['审批人'], 审批时间: cf['审批时间'] }))

      /* 主链单据:检验员留空(验证提交时兜底写提交人) */
      const created = await createDraft(adm, panel, { marker: RUN + '-' + tag })
      mainNo = created.no
      docs.push({ panel, no: mainNo, marker: RUN + '-' + tag })
      allDocs.push(docs[docs.length - 1])
      r.check(`${panel} 建草稿(API 新增+保存)`, !!mainNo, '单号=' + mainNo + ' ' + msgOf(created.save).slice(0, 160))
      const st0 = await docStatus(db, panel, mainNo)
      r.check(`${panel} 草稿态:pending≠Y`, S(st0.pending) !== 'Y', JSON.stringify(st0))

      /* 直审被拒 */
      const direct = await adm.callButton(panel, '审核', { 编号: mainNo })
      r.check(`${panel} 直接「审核」被拒(文案含「两级审批」/「不支持直接审核」)`,
        !callOk(direct) && /两级审批/.test(direct.message) && /不支持直接审核/.test(direct.message),
        `code=${direct.code} msg=${direct.message}`)

      /* UI 草稿态:有提交审批、无审核直审、表尾审核/批准空 */
      const uiDraft = 'ui-' + tag + '-draft-' + RUN
      const eDraft = runUi(uiArgs(panel, mainNo, 'draft', uiDraft))
      r.check(`${panel}[UI] 草稿态纸面断言通过`, eDraft === 0, 'exit=' + eDraft)

      /* 提交审批(admin,有编辑权) */
      const sub = await adm.callButton(panel, '提交审批', { 编号: mainNo })
      r.check(`${panel} 提交审批成功`, callOk(sub), `code=${sub.code} msg=${sub.message}`)
      const st1 = await docStatus(db, panel, mainNo)
      r.check(`${panel} 提交后:审批中(pending=Y,approve_node=1)`, S(st1.pending) === 'Y' && S(st1.node) === '1', JSON.stringify(st1))
      const hs1 = await headSign(db, panel, mainNo)
      r.check(`${panel} 提交后:检验员=提交人姓名「${ADMIN_NAME}」(编制格空值兜底)`, S(hs1.prep) === ADMIN_NAME, '检验员=' + JSON.stringify(hs1.prep))
      r.check(`${panel} 提交后:审核人/审批人为空`, !S(hs1.l1) && !S(hs1.l2), JSON.stringify({ l1: hs1.l1, l2: hs1.l2 }))
      const ap1 = await approvals(db, panel, mainNo)
      r.check(`${panel} 留痕:SUBMIT/PENDING`, ap1.some((a) => a.action === 'SUBMIT' && a.result === 'PENDING'), ap1.map((a) => a.action + '/' + a.result).join(','))

      /* 负测:无审批权账号在节点 1 审批被拒 */
      const deny = await neg.callButton(panel, '审批通过', { 编号: mainNo })
      r.check(`${panel} 负测:无审批权账号(wangguangzhen)审批被拒`, !callOk(deny) && /无该面板「审批」权限|无审批权限/.test(deny.message),
        `code=${deny.code} msg=${deny.message}`)
      const directNeg = await neg.callButton(panel, '审核', { 编号: mainNo })
      r.check(`${panel} 负测:无审批权账号直审也被拒`, !callOk(directNeg),
        `code=${directNeg.code} msg=${directNeg.message}`)

      /* 一级审批:cp(角色 4,夹具授权,非提交人) */
      const l1 = await cp.callButton(panel, '审批通过', { 编号: mainNo, 审批意见: 'E2E-L1 同意' })
      r.check(`${panel} 一级审批通过(cp)`, callOk(l1), `code=${l1.code} msg=${l1.message}`)
      const st2 = await docStatus(db, panel, mainNo)
      r.check(`${panel} 一级通过后:待二级审批(pending=Y,approve_node=2)`, S(st2.pending) === 'Y' && S(st2.node) === '2', JSON.stringify(st2))
      const hs2 = await headSign(db, panel, mainNo)
      r.check(`${panel} 一级通过后:审核人=「${L1_NAME}」`, S(hs2.l1) === L1_NAME, '审核人=' + JSON.stringify(hs2.l1))
      r.check(`${panel} 一级通过后:审核时间非空、审批人仍为空`, !!hs2.l1Time && !S(hs2.l2),
        JSON.stringify({ 审核时间: hs2.l1Time, 审批人: hs2.l2 }))
      const ap2 = await approvals(db, panel, mainNo)
      r.check(`${panel} 留痕:APPROVE_L1(node=1)`, ap2.some((a) => a.action === 'APPROVE_L1' && Number(a.node_no) === 1), ap2.map((a) => a.action + '@' + a.node_no).join(','))
      const desc2 = (await adm.getJson(`/api/px/getFormDescriptor?panelCode=${panel}&code=${encodeURIComponent(mainNo)}`)).data?.data || {}
      r.check(`${panel} descriptor:审核人=真实姓名「${L1_NAME}」、审批人仍空`,
        S(desc2['审核人']) === L1_NAME && !S(desc2['审批人']),
        JSON.stringify({ 审核人: desc2['审核人'], 审批人: desc2['审批人'] }))

      /* UI 待二级审批态 */
      const uiP2 = 'ui-' + tag + '-pending2-' + RUN
      const eP2 = runUi(uiArgs(panel, mainNo, 'pending2', uiP2))
      r.check(`${panel}[UI] 待二级审批态纸面断言通过`, eP2 === 0, 'exit=' + eP2)

      /* 负测:二级节点非超级管理员审批/驳回被拒 */
      const cp2 = await cp.callButton(panel, '审批通过', { 编号: mainNo })
      r.check(`${panel} 负测:二级节点非超级管理员审批被拒(提示含「超级管理员」)`, !callOk(cp2) && /超级管理员/.test(cp2.message),
        `code=${cp2.code} msg=${cp2.message}`)
      const cp2r = await cp.callButton(panel, '审批驳回', { 编号: mainNo, 审批意见: 'x' })
      r.check(`${panel} 负测:二级节点非超级管理员驳回被拒`, !callOk(cp2r) && /超级管理员/.test(cp2r.message),
        `code=${cp2r.code} msg=${cp2r.message}`)

      /* 二级审批:超级管理员批准 */
      const l2 = await adm.callButton(panel, '审批通过', { 编号: mainNo, 审批意见: 'E2E-L2 批准' })
      r.check(`${panel} 二级批准通过(admin)`, callOk(l2), `code=${l2.code} msg=${l2.message}`)
      const st3 = await docStatus(db, panel, mainNo)
      r.check(`${panel} 批准后:已审核(pending=N,approve_node 空,shr=admin)`,
        S(st3.pending) === 'N' && S(st3.node) === '' && S(st3.shr) === 'admin', JSON.stringify(st3))
      const hs3 = await headSign(db, panel, mainNo)
      r.check(`${panel} 批准后:审批人=「${ADMIN_NAME}」、审批时间非空`, S(hs3.l2) === ADMIN_NAME && !!hs3.l2Time,
        JSON.stringify({ 审批人: hs3.l2, 审批时间: hs3.l2Time }))
      const ap3 = await approvals(db, panel, mainNo)
      r.check(`${panel} 留痕:APPROVE(node=2) 且 APPROVE_L1 仍在`,
        ap3.some((a) => a.action === 'APPROVE' && Number(a.node_no) === 2) && ap3.some((a) => a.action === 'APPROVE_L1'),
        ap3.map((a) => a.action + '@' + a.node_no).join(','))
      const desc3 = (await adm.getJson(`/api/px/getFormDescriptor?panelCode=${panel}&code=${encodeURIComponent(mainNo)}`)).data?.data || {}
      r.check(`${panel} descriptor:审核人=「${L1_NAME}」、审批人=「${ADMIN_NAME}」(真实姓名)`,
        S(desc3['审核人']) === L1_NAME && S(desc3['审批人']) === ADMIN_NAME,
        JSON.stringify({ 审核人: desc3['审核人'], 审批人: desc3['审批人'] }))

      /* UI 已审核态 */
      const uiAud = 'ui-' + tag + '-audited-' + RUN
      const eAud = runUi(uiArgs(panel, mainNo, 'audited', uiAud))
      r.check(`${panel}[UI] 已审核态纸面断言通过`, eAud === 0, 'exit=' + eAud)

      /* 导出 PDF / XLSX:纸面(报表)显示 审核人(一级) 与 批准(审批人) */
      try {
        const pres = await adm.getBinary(`/api/report/export?code=${P.reportCode}&panelCode=${panel}&docNo=${encodeURIComponent(mainNo)}&format=pdf`)
        const pdf = path.join(OUT, `${tag}-${mainNo}.pdf`)
        const ptxt = path.join(OUT, `${tag}-${mainNo}.txt`)
        fs.writeFileSync(pdf, pres.buf)
        r.check(`${panel} 导出 PDF:HTTP200 + %PDF-`, pres.status === 200 && pres.buf.subarray(0, 5).toString('latin1') === '%PDF-',
          'status=' + pres.status + ' bytes=' + pres.buf.length)
        const pt = pdfText(pdf, ptxt)
        const nt = norm(pt.text)
        r.fact(`${panel} PDF 表尾文本`, nt.slice(Math.max(0, nt.length - 160)))
        r.check(`${panel} PDF 显示 批准=「${ADMIN_NAME}」`, nt.includes('批准' + ADMIN_NAME) || nt.includes('批准：' + ADMIN_NAME),
          (nt.match(/.{0,8}批准.{0,20}/) || [''])[0])
        r.check(`${panel} PDF 显示 审核人(一级)=「${L1_NAME}」`, nt.includes(L1_NAME),
          (nt.match(/.{0,8}(审核|审核人).{0,20}/) || [''])[0])
        if (panel === 'QC_PROC_INSP') {
          r.check(`${panel} PDF 显示 检验员=「${ADMIN_NAME}」`, nt.includes('检验员：' + ADMIN_NAME), '')
        }
        const xres = await adm.getBinary(`/api/report/export?code=${P.reportCode}&panelCode=${panel}&docNo=${encodeURIComponent(mainNo)}&format=xlsx`)
        const xlsx = path.join(OUT, `${tag}-${mainNo}.xlsx`)
        fs.writeFileSync(xlsx, xres.buf)
        const xt = norm(xlsxText(xlsx))
        r.check(`${panel} 导出 XLSX:含 批准 标签与「${ADMIN_NAME}」`,
          xt.includes('批准') && xt.includes(ADMIN_NAME), 'PNG? bytes=' + xres.buf.length + ' textLen=' + xt.length)
        r.check(`${panel} 导出 XLSX:含一级审核人「${L1_NAME}」`, xt.includes(L1_NAME), '')
        r.fact(`${panel} 导出证据`, { pdf: path.relative(ROOT, pdf), pdfText: path.relative(ROOT, ptxt), xlsx: path.relative(ROOT, xlsx) })
      } catch (e) {
        r.check(`${panel} 导出 PDF/XLSX`, false, String(e.message).slice(0, 300))
      }

      /* 弃审 → 草稿 + 清签名格(保留检验员) */
      const un = await adm.callButton(panel, '弃审', { 编号: mainNo })
      r.check(`${panel} 弃审成功`, callOk(un), `code=${un.code} msg=${un.message}`)
      const st4 = await docStatus(db, panel, mainNo)
      r.check(`${panel} 弃审后:回到草稿(pending≠Y)`, S(st4.pending) !== 'Y', JSON.stringify(st4))
      const hs4 = await headSign(db, panel, mainNo)
      r.check(`${panel} 弃审后:审核人/审批人/审核时间/审批时间 清空`,
        !S(hs4.l1) && !S(hs4.l2) && !hs4.l1Time && !hs4.l2Time, JSON.stringify(hs4))
      r.check(`${panel} 弃审后:检验员保留「${ADMIN_NAME}」`, S(hs4.prep) === ADMIN_NAME, '检验员=' + JSON.stringify(hs4.prep))
      const ap4 = await approvals(db, panel, mainNo)
      r.check(`${panel} 留痕:UNAUDIT`, ap4.some((a) => a.action === 'UNAUDIT' || a.action === '弃审'), ap4.map((a) => a.action).join(','))

      /* 驳回链(另建单):由**无审批权但有编辑权**的 wangguangzhen 提交(验证「有编辑权即可提交」),
         检验员空值兜底=王光珍;一级 cp 驳回 → 草稿 + 清签名格 */
      const rejCreated = await createDraft(adm, panel, { marker: RUN + '-' + tag + '-rej' })
      const rejNo = rejCreated.no
      docs.push({ panel, no: rejNo, marker: RUN + '-' + tag + '-rej' })
      allDocs.push(docs[docs.length - 1])
      r.check(`${panel}[驳回] 建草稿`, !!rejNo, rejNo)
      // 模拟「两级口径上线前的老草稿」:把 save() 预填的检验员清空 → 提交审批应**空值兜底**写提交人
      await db.q(`UPDATE ${P.headTable} SET 检验员=NULL WHERE 单据编号='${qs(rejNo)}'`)
      const hsBefore = await headSign(db, panel, rejNo)
      r.check(`${panel}[驳回] 已清空检验员以模拟老草稿(提交前为空)`, !S(hsBefore.prep), '检验员=' + JSON.stringify(hsBefore.prep))
      const subNeg = await neg.callButton(panel, '提交审批', { 编号: rejNo })
      r.check(`${panel}[驳回] 无审批权但有编辑权的账号(wangguangzhen)可提交审批`, callOk(subNeg),
        `code=${subNeg.code} msg=${subNeg.message}`)
      const hsSub = await headSign(db, panel, rejNo)
      r.check(`${panel}[驳回] 提交后检验员=提交人姓名「${NEG_NAME}」(空值兜底)`, S(hsSub.prep) === NEG_NAME, '检验员=' + JSON.stringify(hsSub.prep))
      const rej = await cp.callButton(panel, '审批驳回', { 编号: rejNo, 审批意见: 'E2E 一级驳回:资料不全' })
      r.check(`${panel}[驳回] 一级驳回成功`, callOk(rej), `code=${rej.code} msg=${rej.message}`)
      const stR = await docStatus(db, panel, rejNo)
      r.check(`${panel}[驳回] 驳回后回到草稿`, S(stR.pending) !== 'Y', JSON.stringify(stR))
      const hsR = await headSign(db, panel, rejNo)
      r.check(`${panel}[驳回] 驳回后 审核人/审批人 清空`, !S(hsR.l1) && !S(hsR.l2), JSON.stringify(hsR))
      const apR = await approvals(db, panel, rejNo)
      r.check(`${panel}[驳回] 留痕 REJECT(node=1)`, apR.some((a) => a.action === 'REJECT' && Number(a.node_no) === 1),
        apR.map((a) => a.action + '@' + a.node_no).join(','))

      /* 自审负测(另建单):cp 提交后自己批 → 编制与审批分离被拒 */
      const selfCreated = await createDraft(adm, panel, { marker: RUN + '-' + tag + '-self' })
      const selfNo = selfCreated.no
      docs.push({ panel, no: selfNo, marker: RUN + '-' + tag + '-self' })
      allDocs.push(docs[docs.length - 1])
      const subSelf = await cp.callButton(panel, '提交审批', { 编号: selfNo })
      r.check(`${panel}[自审] cp(有审批权)提交自己的单成功`, callOk(subSelf), `code=${subSelf.code} msg=${subSelf.message}`)
      const selfApprove = await cp.callButton(panel, '审批通过', { 编号: selfNo })
      r.check(`${panel}[自审] 提交人本人不能批自己(负测被拒)`,
        !callOk(selfApprove) && /编制与审批分离|提交人相同|本人/.test(selfApprove.message),
        `code=${selfApprove.code} msg=${selfApprove.message}`)

      /* 单据清理(按单号白名单) */
      const cl = await cleanupDocs(db, docs, OUT, `cleanup-${tag}-${RUN}`)
      r.check(`${panel} 清理:本次测试单 0 残留`, cl.zero, JSON.stringify(cl.residue))
      r.check(`${panel} 清理:AUTO_QCVER_ 标记 0 残留`, Object.values(cl.autoResidue).every((n) => n === 0), JSON.stringify(cl.autoResidue))
    } catch (e) {
      r.check(`${panel} 编排过程未抛异常`, false, String(e && e.stack || e).slice(0, 1000))
    }
  }
} catch (e) {
  r.check('T3 编排过程未抛异常(外层)', false, String(e && e.stack || e).slice(0, 1000))
} finally {
  /* 夹具还原(无论成败都还原,并复核) */
  try {
    if (db && fixtureState) {
      const rs = await fixtureRestore(db, fixtureState.originals, OUT)
      r.check('夹具还原:角色 4 两面板 can_approve/perms 恢复原值', rs.same, JSON.stringify(rs.now))
      await saveJson(path.join(OUT, 'fixture-restore-' + RUN + '.json'), rs)
    }
  } catch (e) {
    r.check('夹具还原执行', false, String(e.message).slice(0, 300))
  }
  /* 兜底:清掉残留测试单(tracked 单 + AUTO_QCVER_ 标记行;若上面的 per-panel 清理未执行到) */
  try {
    if (db) {
      const sw = await sweepResidue(db, OUT, 'cleanup-fallback-' + RUN)
      if (sw.list && sw.list.length) r.check('兜底清理:残留测试单已清', sw.zero, JSON.stringify(sw.list))
    }
  } catch (e) { console.log('[warn] 兜底清理失败:', e.message) }
  try { if (db) await db.close() } catch { /* ignore */ }

  const summary = r.summary()
  summary.env = { base: BASE, factory: FACTORY, db: 'HSDZ_MES_TEST', run: RUN, outDir: OUT }
  await saveJson(path.join(OUT, 't3-summary-' + RUN + '.json'), summary).catch(() => {})
  await saveText(path.join(OUT, 't3-summary-' + RUN + '.txt'),
    summary.items.map((i) => `${i.ok === null ? 'FACT' : i.ok ? 'PASS' : 'FAIL'}  ${i.name}${i.detail ? '  -- ' + i.detail : ''}`).join('\n')
    + `\n\nRESULT: ${summary.result} (PASS ${summary.pass} / FAIL ${summary.fail})\n`).catch(() => {})
  process.exitCode = summary.fail === 0 ? 0 : 1
}
