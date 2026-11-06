/**
 * _e2e-t3-regress.mjs —— 【2026-11-06 第二轮追加变更】两级审批快速回归(制程检验单)
 *
 * 目的:本轮只改了 ButtonService.save() 的「检验方案」兜底逻辑 ⇒ 回归证明
 *   「提交审批 → 一级(夹具 cp)通过 → 超级管理员批准 → 已审核」全链、签名格、留痕不受影响。
 * 覆盖:直审仍被拒 / 提交后 pending=Y,node=1 / 一级 → node=2 + 审核人+APPROVE_L1@1 /
 *       二级 → pending=N + 审批人+APPROVE@2 / descriptor 真名 / UI 已审核态表尾三格 / 清理。
 * 测试夹具:测试库临时给角色 4(研发审核,cp/陈秀丽)两面板审批权,结束原值还原。
 *
 * 用法:node tools/archive/_qc-insp-verify-20261106/_e2e-t3-regress.mjs [--base http://127.0.0.1:8091]
 * 产物:evidence/t3-round2/
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import {
  Results, ROOT, login, loginOrSign, api, okCall, saveJson, saveText, nowStamp, evidenceDir,
} from './_lib.mjs'
import {
  PANEL, parseArgs, openTestDb, createDraft, cleanupDocs, docStatus, headSign, approvals,
  S, fixtureGrant, fixtureRestore, FIXTURE, sweepResidue,
} from './_e2e-common.mjs'

const { arg } = parseArgs()
const BASE = String(arg('base', 'http://127.0.0.1:8091')).replace(/\/$/, '')
const FACTORY = 'YJ_TEST'
const RUN = nowStamp()
const OUT = evidenceDir('t3-round2')
const UI = path.join(ROOT, 'tools/archive/_qc-insp-verify-20261106/_ui-verify.mjs')
const PANEL_CODE = 'QC_PROC_INSP'
const ADMIN_NAME = '系统管理员'
const L1_NAME = FIXTURE.approverName // 陈秀丽
const r = new Results('T3-R2 两级审批快速回归(制程) @ ' + BASE + ' run=' + RUN)
r.fact('参数', { base: BASE, factory: FACTORY, db: 'HSDZ_MES_TEST', run: RUN, fixture: FIXTURE })
const docs = []
let db
let fixtureState = null

try {
  db = await openTestDb()
  const admin = await login(BASE, { factory: FACTORY })
  const adm = api(BASE, admin.token)
  const cpSess = await loginOrSign(BASE, { userName: FIXTURE.approverUser, factory: FACTORY })
  const cp = api(BASE, cpSess.token)
  r.check('8091 登录成功(admin/cp)', !!admin.token && !!cpSess.token,
    `admin=${admin.user.realName} cp=${cpSess.user.realName || '(自签)'}(${cpSess.tokenSource})`)

  /* 夹具 */
  fixtureState = await fixtureGrant(db, OUT)
  const perms = (await cp.getJson('/api/auth/perms')).data
  r.check('夹具生效:cp approvePanels 含 QC_PROC_INSP',
    (perms.approvePanels || []).includes(PANEL_CODE), JSON.stringify(perms.approvePanels))

  /* 建单 + 全链 */
  const created = await createDraft(adm, PANEL_CODE, { marker: RUN })
  const no = created.no
  docs.push({ panel: PANEL_CODE, no, marker: RUN })
  r.check('建草稿', !!no, no)
  const direct = await adm.callButton(PANEL_CODE, '审核', { 编号: no })
  r.check('回归:直接「审核」仍被拒(两级审批)', !okCall(direct) && /两级审批/.test(direct.message),
    `code=${direct.code} msg=${direct.message}`)
  const sub = await adm.callButton(PANEL_CODE, '提交审批', { 编号: no })
  r.check('提交审批成功', okCall(sub), `code=${sub.code} msg=${sub.message}`)
  const st1 = await docStatus(db, PANEL_CODE, no)
  r.check('提交后 pending=Y, approve_node=1', S(st1.pending) === 'Y' && S(st1.node) === '1', JSON.stringify(st1))
  const hs1 = await headSign(db, PANEL_CODE, no)
  r.check('提交后 检验员=提交人姓名「系统管理员」', S(hs1.prep) === ADMIN_NAME, '检验员=' + JSON.stringify(hs1.prep))
  const l1 = await cp.callButton(PANEL_CODE, '审批通过', { 编号: no, 审批意见: 'R2 回归-L1' })
  r.check('一级审批通过(cp 夹具)', okCall(l1), `code=${l1.code} msg=${l1.message}`)
  const st2 = await docStatus(db, PANEL_CODE, no)
  r.check('一级后 pending=Y, approve_node=2', S(st2.pending) === 'Y' && S(st2.node) === '2', JSON.stringify(st2))
  const hs2 = await headSign(db, PANEL_CODE, no)
  r.check('一级后 审核人=「陈秀丽」、审核时间非空、审批人空', S(hs2.l1) === L1_NAME && !!hs2.l1Time && !S(hs2.l2),
    JSON.stringify({ l1: hs2.l1, l1Time: hs2.l1Time, l2: hs2.l2 }))
  const ap2 = await approvals(db, PANEL_CODE, no)
  r.check('留痕 APPROVE_L1(node=1)', ap2.some((a) => a.action === 'APPROVE_L1' && Number(a.node_no) === 1),
    ap2.map((a) => a.action + '@' + a.node_no).join(','))
  const l2 = await adm.callButton(PANEL_CODE, '审批通过', { 编号: no, 审批意见: 'R2 回归-L2' })
  r.check('二级批准通过(admin)', okCall(l2), `code=${l2.code} msg=${l2.message}`)
  const st3 = await docStatus(db, PANEL_CODE, no)
  r.check('批准后 已审核(pending=N, approve_node 空, shr=admin)',
    S(st3.pending) === 'N' && S(st3.node) === '' && S(st3.shr) === 'admin', JSON.stringify(st3))
  const hs3 = await headSign(db, PANEL_CODE, no)
  r.check('批准后 审批人=「系统管理员」、审批时间非空', S(hs3.l2) === ADMIN_NAME && !!hs3.l2Time,
    JSON.stringify({ l2: hs3.l2, l2Time: hs3.l2Time }))
  const ap3 = await approvals(db, PANEL_CODE, no)
  r.check('留痕 APPROVE(node=2) 且 APPROVE_L1 仍在',
    ap3.some((a) => a.action === 'APPROVE' && Number(a.node_no) === 2) && ap3.some((a) => a.action === 'APPROVE_L1'),
    ap3.map((a) => a.action + '@' + a.node_no).join(','))
  const desc = (await adm.getJson(`/api/px/getFormDescriptor?panelCode=${PANEL_CODE}&code=${encodeURIComponent(no)}`)).data?.data || {}
  r.check('descriptor 审核人=陈秀丽、审批人=系统管理员', S(desc['审核人']) === L1_NAME && S(desc['审批人']) === ADMIN_NAME,
    JSON.stringify({ 审核人: desc['审核人'], 审批人: desc['审批人'] }))

  /* UI 已审核态表尾三格 */
  const uiPrefix = 'ui-t3r2-audited-' + RUN
  let uiExit = 0
  try {
    execFileSync(process.execPath, [UI,
      '--base', BASE, '--factory', FACTORY, '--panel', PANEL_CODE, '--docNo', no,
      '--task', 't3-paper', '--state', 'audited',
      '--expect-preparer', ADMIN_NAME, '--expect-l1', L1_NAME, '--expect-l2', ADMIN_NAME,
      '--out', OUT, '--prefix', uiPrefix], { cwd: ROOT, stdio: 'inherit' })
  } catch (e) { uiExit = typeof e.status === 'number' ? e.status : 1 }
  r.check('UI 已审核态纸面断言通过(表尾 检验人/审核人/批准)', uiExit === 0, 'exit=' + uiExit + ' ' + path.join(OUT, uiPrefix + '.json'))

  /* 清理 */
  const cl = await cleanupDocs(db, docs, OUT, 'cleanup-' + RUN)
  r.check('清理:测试单 5 表 0 残留', cl.zero, JSON.stringify(cl.residue))
} catch (e) {
  r.check('T3-R2 编排过程未抛异常', false, String(e && e.stack || e).slice(0, 900))
} finally {
  try {
    if (db && fixtureState) {
      const rs = await fixtureRestore(db, fixtureState.originals, OUT)
      r.check('夹具还原:角色 4 两面板 can_approve/perms 恢复原值', rs.same, JSON.stringify(rs.now))
      await saveJson(path.join(OUT, 'fixture-restore-' + RUN + '.json'), rs)
    }
  } catch (e) { r.check('夹具还原执行', false, String(e.message).slice(0, 300)) }
  try {
    if (db) {
      const sw = await sweepResidue(db, OUT, 'cleanup-sweep-' + RUN)
      if (sw.list && sw.list.length) r.check('兜底清理:残留测试单已清', sw.zero, JSON.stringify(sw.list))
    }
  } catch (e) { console.log('[warn] 兜底清理失败:', e.message) }
  try { if (db) await db.close() } catch { /* ignore */ }

  const summary = r.summary()
  summary.env = { base: BASE, factory: FACTORY, db: 'HSDZ_MES_TEST', run: RUN, outDir: OUT }
  await saveJson(path.join(OUT, 't3r2-summary-' + RUN + '.json'), summary).catch(() => {})
  await saveText(path.join(OUT, 't3r2-summary-' + RUN + '.txt'),
    summary.items.map((i) => `${i.ok === null ? 'FACT' : i.ok ? 'PASS' : 'FAIL'}  ${i.name}${i.detail ? '  -- ' + i.detail : ''}`).join('\n')
    + `\n\nRESULT: ${summary.result} (PASS ${summary.pass} / FAIL ${summary.fail})\n`).catch(() => {})
  process.exitCode = summary.fail === 0 ? 0 : 1
}
