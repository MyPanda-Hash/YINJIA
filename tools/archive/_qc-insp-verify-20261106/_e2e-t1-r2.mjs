/**
 * _e2e-t1-r2.mjs —— 【2026-11-06 第二轮追加变更】T1 制程检验单:检验方案 = 默认值 + 可修改
 *
 * 用户第二轮口径:「这个检验方案需要能够默认为这个的情况下也能进行修改」
 *   ⇒ 取代首轮的两条断言:①「检验方案 readonly/只读文本」 ②「保存时强制写固定值」。
 * 当前口径:
 *   · 新建/自动出单**默认**「出货控制计划执行」(后端空值兜底 + 自动出单写初值);
 *   · 该格**可人工修改**,保存后落用户改值,**再保存不得被强刷回默认**;
 *   · 清空后保存 → 空值兜底恢复默认。
 * 同时回归:工序仍 hidden、结果判断仍下拉且可选/落库、单据编号仍只读、检验员仍可编辑。
 *
 * 用法:node tools/archive/_qc-insp-verify-20261106/_e2e-t1-r2.mjs [--base http://127.0.0.1:8091]
 * 产物:evidence/t1-round2/
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import {
  Results, ROOT, login, api, okCall, saveJson, saveText, nowStamp, evidenceDir, xlsxText, norm,
} from './_lib.mjs'
import {
  PANEL, parseArgs, openTestDb, createDraft, cleanupDocs, docStatus, headValue, S, sweepResidue,
} from './_e2e-common.mjs'

const { arg } = parseArgs()
const BASE = String(arg('base', 'http://127.0.0.1:8091')).replace(/\/$/, '')
const FACTORY = 'YJ_TEST'
const RUN = nowStamp()
const OUT = evidenceDir('t1-round2')
const UI = path.join(ROOT, 'tools/archive/_qc-insp-verify-20261106/_ui-verify.mjs')
const PANEL_CODE = 'QC_PROC_INSP'
const DEFAULT_PLAN = '出货控制计划执行'
const UI_PLAN = 'E2E-方案-UI-' + RUN
const API_PLAN = 'E2E-方案-API-' + RUN
const r = new Results('T1-R2 检验方案默认值+可修改 @ ' + BASE + ' run=' + RUN)
r.fact('参数', { base: BASE, factory: FACTORY, db: 'HSDZ_MES_TEST', run: RUN, defaultPlan: DEFAULT_PLAN, uiPlan: UI_PLAN, apiPlan: API_PLAN })
const docs = []
let db

function runUi(argv) {
  console.log('\n── UI 用例 → ' + argv.join(' ') + ' ──')
  let exit = 0
  try { execFileSync(process.execPath, argv, { cwd: ROOT, stdio: 'inherit' }) } catch (e) { exit = typeof e.status === 'number' ? e.status : 1 }
  return exit
}
const uiJsonOf = (prefix) => {
  try { return JSON.parse(fs.readFileSync(path.join(OUT, prefix + '.json'), 'utf8')) } catch { return null }
}
const planOf = async (no) => S(await headValue(db, PANEL_CODE, no, '检验方案'))

try {
  db = await openTestDb()
  const { token, user } = await login(BASE, { factory: FACTORY })
  const cli = api(BASE, token)
  r.check('8091 登录成功(测试账套 YJ_TEST)', !!token, 'realName=' + (user.realName || ''))

  /* ── ① 契约:检验方案已恢复可编辑(取代首轮 "readonly" 断言) ── */
  const cfg = (await cli.getJson('/api/px/getPanelConfig?panelCode=' + PANEL_CODE)).data || {}
  const hf = cfg.dataSchema?.fields || []
  const df = cfg.detail?.tabs?.[0]?.fields || []
  const planField = hf.find((f) => f.dataName === '检验方案')
  const gxField = hf.find((f) => f.dataName === '工序')
  const verdictField = df.find((f) => f.dataName === '结果判断')
  r.check('T1R2[配置] 「检验方案」**不是只读**(readonly 缺省/false),dataType=文本',
    !!planField && planField.readonly !== true && (planField.dataType === '文本'),
    JSON.stringify(planField))
  r.check('T1R2[配置] 回归:「工序」仍不可见(hidden=true)', !gxField || gxField.hidden === true, JSON.stringify(gxField))
  r.check('T1R2[配置] 回归:明细「结果判断」仍是下拉框(合格/不合格)',
    !!verdictField && verdictField.dataType === '下拉框' && Array.isArray(verdictField.options)
    && verdictField.options.includes('合格') && verdictField.options.includes('不合格'),
    JSON.stringify(verdictField))
  const fRow = await db.one(
    `SELECT editable, required, hidden, visible, data_type FROM yj_field WHERE panel_code='${PANEL_CODE}' AND col_name=N'检验方案'`)
  r.check('T1R2[DB] yj_field 检验方案 editable=1 / required=0 / hidden=0 / visible=1 / data_type=文本',
    !!fRow && Number(fRow.editable) === 1 && Number(fRow.required) === 0 && Number(fRow.hidden) === 0
    && Number(fRow.visible) === 1 && fRow.data_type === '文本', JSON.stringify(fRow))
  const gxRow = await db.one(
    `SELECT hidden, visible FROM yj_field WHERE panel_code='${PANEL_CODE}' AND col_name=N'工序'`)
  r.check('T1R2[DB] 回归:yj_field 工序 hidden=1 / visible=0', !!gxRow && Number(gxRow.hidden) === 1 && Number(gxRow.visible) === 0,
    JSON.stringify(gxRow))
  const emptyPlan = (await db.one(`SELECT COUNT(*) n FROM qc_proc_insp_head WHERE ISNULL(检验方案,'') = ''`)).n
  const nonDefault = (await db.one(`SELECT COUNT(*) n FROM qc_proc_insp_head WHERE ISNULL(检验方案,'') <> N'${DEFAULT_PLAN}'`)).n
  r.check('T1R2[DB] 迁移后全表无空检验方案行(历史空值已补默认)', emptyPlan === 0, '空值行=' + emptyPlan)
  r.fact('T1R2[DB] 当前非默认方案行数(用户手改值保留;本轮测试前)', nonDefault)

  /* ── ② 单据 A:API 建单不传检验方案 → 默认值;UI 默认显示 + 改成自定义 + 保存落库 ── */
  const markerA = RUN
  const createdA = await createDraft(cli, PANEL_CODE, { marker: markerA })
  const noA = createdA.no
  docs.push({ panel: PANEL_CODE, no: noA, marker: markerA })
  r.check('T1R2 建草稿A(API 不传检验方案)', !!noA, '单号=' + noA)
  const planA0 = await planOf(noA)
  r.check('T1R2[API+DB] 建单不传检验方案 → 落库默认「出货控制计划执行」', planA0 === DEFAULT_PLAN, 'DB值=' + JSON.stringify(planA0))
  const stA = await docStatus(db, PANEL_CODE, noA)
  r.check('T1R2[DB] 单据A为草稿', S(stA.pending) !== 'Y', JSON.stringify(stA))

  // UI-1:输入框形态 + 默认显示 + 改成自定义 + 结果判断选「不合格」+ 保存 + 纸张 Excel 导出
  const uiA1 = 'ui-t1r2-A1-' + RUN
  const eA1 = runUi([UI, '--base', BASE, '--factory', FACTORY, '--panel', PANEL_CODE, '--docNo', noA,
    '--task', 't1-proc-draft', '--expect-plan', 'editable', '--expect-default-plan',
    '--fill', JSON.stringify({ 检验方案: UI_PLAN, 结果判断: '不合格' }), '--save', '--export-excel',
    '--out', OUT, '--prefix', uiA1])
  r.check('T1R2[UI-1] UI 断言通过(输入框/默认值/改值/结果判断/保存)', eA1 === 0, 'exit=' + eA1 + ' ' + path.join(OUT, uiA1 + '.json'))
  const planA1 = await planOf(noA)
  r.check('T1R2[DB] UI 改成自定义方案并保存 → **落用户改值**(未被强刷回默认)', planA1 === UI_PLAN,
    'DB值=' + JSON.stringify(planA1) + ' 期望=' + UI_PLAN)
  const detA = await db.one(`SELECT TOP 1 结果判断 FROM qc_proc_insp_detail WHERE 单据编号='${noA.replace(/'/g, "''")}' ORDER BY 行号`)
  r.check('T1R2[DB] 回归:UI 结果判断选「不合格」保存落库', !!detA && S(detA.结果判断) === '不合格', JSON.stringify(detA))
  // 纸张 Excel 导出:检验方案(自定义)与结果判断值都在
  try {
    const j = uiJsonOf(uiA1)
    const exFact = (j?.items || []).find((i) => i.name === 'T1[UI] 纸张 Excel 导出证据')
    const ex = exFact ? JSON.parse(exFact.detail) : null
    if (ex?.downloadPath && fs.existsSync(ex.downloadPath)) {
      const xt = norm(xlsxText(ex.downloadPath))
      r.check('T1R2[UI] 纸张 Excel 导出含 自定义检验方案 + 结果判断值',
        xt.includes(UI_PLAN.replace(/\s+/g, '')) && xt.includes('不合格'), '文本长度=' + xt.length)
    } else {
      r.check('T1R2[UI] 纸张 Excel 导出文件存在', false, JSON.stringify(ex).slice(0, 300))
    }
  } catch (e) {
    r.check('T1R2[UI] 解析纸张 Excel 导出', false, String(e.message).slice(0, 300))
  }

  // UI-2:重开(显示仍是自定义值)+ 改结果判断为「合格」再保存 → 检验方案保持自定义(再保存不覆盖)
  const uiA2 = 'ui-t1r2-A2-' + RUN
  const eA2 = runUi([UI, '--base', BASE, '--factory', FACTORY, '--panel', PANEL_CODE, '--docNo', noA,
    '--task', 't1-proc-draft', '--expect-plan', 'editable',
    '--fill', JSON.stringify({ 结果判断: '合格' }), '--save',
    '--out', OUT, '--prefix', uiA2])
  r.check('T1R2[UI-2] 重开纸张再保存 UI 断言通过', eA2 === 0, 'exit=' + eA2)
  const planA2 = await planOf(noA)
  r.check('T1R2[DB] 再点一次保存后 检验方案仍=用户改值(不被覆盖)', planA2 === UI_PLAN, 'DB值=' + JSON.stringify(planA2))
  const detA2 = await db.one(`SELECT TOP 1 结果判断 FROM qc_proc_insp_detail WHERE 单据编号='${noA.replace(/'/g, "''")}' ORDER BY 行号`)
  r.check('T1R2[DB] 第二次保存结果判断=合格(顺带验证保存链路)', !!detA2 && S(detA2.结果判断) === '合格', JSON.stringify(detA2))

  // UI-3:清空检验方案后保存 → 空值兜底恢复默认
  const uiA3 = 'ui-t1r2-A3-' + RUN
  const eA3 = runUi([UI, '--base', BASE, '--factory', FACTORY, '--panel', PANEL_CODE, '--docNo', noA,
    '--task', 't1-proc-draft', '--expect-plan', 'editable',
    '--fill', JSON.stringify({ 检验方案: '' }), '--save',
    '--out', OUT, '--prefix', uiA3])
  r.check('T1R2[UI-3] 清空检验方案 UI 操作通过', eA3 === 0, 'exit=' + eA3)
  const planA3 = await planOf(noA)
  r.check('T1R2[DB] 清空检验方案后保存 → 空值兜底恢复默认「出货控制计划执行」',
    planA3 === DEFAULT_PLAN, 'DB值=' + JSON.stringify(planA3))

  /* ── ③ 单据 B:API 侧保存自定义值,再次保存仍保留(不被后端覆盖) ── */
  const markerB = RUN + '-B'
  const createdB = await createDraft(cli, PANEL_CODE, { marker: markerB })
  const noB = createdB.no
  docs.push({ panel: PANEL_CODE, no: noB, marker: markerB })
  r.check('T1R2 建草稿B(API 不传检验方案)', !!noB, '单号=' + noB)
  r.check('T1R2[DB] 单据B默认值', (await planOf(noB)) === DEFAULT_PLAN, 'DB值=' + JSON.stringify(await planOf(noB)))
  const basePayload = { 编号: noB, ...PANEL[PANEL_CODE].createHead(markerB), 检验方案: API_PLAN }
  const s1 = await cli.callButton(PANEL_CODE, '保存', basePayload)
  r.check('T1R2[API] 保存自定义检验方案', okCall(s1), `code=${s1.code} msg=${s1.message}`)
  r.check('T1R2[DB] API 保存自定义方案 → 落库自定义值', (await planOf(noB)) === API_PLAN, 'DB值=' + JSON.stringify(await planOf(noB)))
  const s2 = await cli.callButton(PANEL_CODE, '保存', basePayload)
  r.check('T1R2[API] 再次保存(同载荷)', okCall(s2), `code=${s2.code} msg=${s2.message}`)
  r.check('T1R2[DB] API 再次保存后仍=自定义值(不再强制固定值)', (await planOf(noB)) === API_PLAN, 'DB值=' + JSON.stringify(await planOf(noB)))

  /* ── ④ 清理 ── */
  const cl = await cleanupDocs(db, docs, OUT, 'cleanup-' + RUN)
  r.check('T1R2 清理:测试单 5 表 0 残留', cl.zero, JSON.stringify(cl.residue))
  r.check('T1R2 清理:AUTO_QCVER_ 标记 0 残留', Object.values(cl.autoResidue).every((n) => n === 0), JSON.stringify(cl.autoResidue))

  const summary = r.summary()
  summary.env = { base: BASE, factory: FACTORY, db: 'HSDZ_MES_TEST', run: RUN, docs, cleanup: cl, verdict: 'T1R2' }
  await saveJson(path.join(OUT, 't1r2-summary-' + RUN + '.json'), summary)
  await saveText(path.join(OUT, 't1r2-summary-' + RUN + '.txt'),
    summary.items.map((i) => `${i.ok === null ? 'FACT' : i.ok ? 'PASS' : 'FAIL'}  ${i.name}${i.detail ? '  -- ' + i.detail : ''}`).join('\n')
    + `\n\nRESULT: ${summary.result} (PASS ${summary.pass} / FAIL ${summary.fail})\n`)
  process.exitCode = summary.fail === 0 ? 0 : 1
} catch (e) {
  r.check('T1R2 编排过程未抛异常', false, String(e && e.stack || e).slice(0, 900))
  const summary = r.summary()
  await saveJson(path.join(OUT, 't1r2-summary-' + RUN + '-fatal.json'), summary).catch(() => {})
  process.exitCode = 2
} finally {
  try {
    if (db) {
      const sw = await sweepResidue(db, OUT, 'cleanup-sweep-' + RUN)
      if (sw.list && sw.list.length) r.check('兜底清理:本轮/标记残留测试单已清', sw.zero, JSON.stringify(sw.list))
    }
  } catch (e) { console.log('[warn] 兜底清理失败:', e.message) }
  try { if (db) await db.close() } catch { /* ignore */ }
}
