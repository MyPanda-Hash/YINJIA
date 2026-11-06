/**
 * _e2e-t2.mjs —— 需求 T2:出厂检验报告(QC_OQC_REPORT)「产品编码」可填 + 草稿态可填性
 *
 * 验收点:
 *   1) 抬头「产品编码」可填写(草稿态),保存落库
 *   2) 草稿态除下拉/日期控件与审批区(检验员=编制 / 审核 / 批准)外,其余字段均可填写;
 *      报告编号 / 检验员 / 审核 / 批准 只读
 *
 * 验证方式(8091 + 测试库):
 *   · yj_field 台账 + getPanelConfig 契约
 *   · API 建 OQC 草稿(产品编码留空)
 *   · Playwright 打开纸张:断言 产品编码 是输入框、报告编号/审批区是只读文本、
 *     抬头其余字段 + 明细/结论/备注/卫生安全 可填 → 填产品编码 → 侧栏「保存」→ DB 落值
 *   · 列出可填控件清单与需求比对;按单号白名单清理
 *
 * 用法:node tools/archive/_qc-insp-verify-20261106/_e2e-t2.mjs [--base http://127.0.0.1:8091]
 * 产物:evidence/t2/
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { Results, ROOT, login, api, saveJson, saveText, nowStamp, evidenceDir } from './_lib.mjs'
import { parseArgs, openTestDb, createDraft, cleanupDocs, headValue, S, sweepResidue } from './_e2e-common.mjs'

const { arg } = parseArgs()
const BASE = String(arg('base', 'http://127.0.0.1:8091')).replace(/\/$/, '')
const FACTORY = 'YJ_TEST'
const STAMP = nowStamp()
const RUN = STAMP
const OUT = evidenceDir('t2')
const UI = path.join(ROOT, 'tools/archive/_qc-insp-verify-20261106/_ui-verify.mjs')
const PANEL_CODE = 'QC_OQC_REPORT'
const P = PANEL_CODE
const UI_PRODUCT_CODE = 'AUTO-UI-PROD-' + RUN
const r = new Results('T2 出厂检验报告产品编码可填 @ ' + BASE + ' run=' + RUN)
r.fact('参数', { base: BASE, factory: FACTORY, db: 'HSDZ_MES_TEST', run: RUN, uiProductCode: UI_PRODUCT_CODE })
const docs = []
let db

try {
  db = await openTestDb()
  const { token, user } = await login(BASE, { factory: FACTORY })
  const cli = api(BASE, token)
  r.check('8091 登录成功(测试账套)', !!token, 'realName=' + (user.realName || ''))

  /* ── ① 台账/契约 ── */
  const fRows = await db.q(
    `SELECT label, editable, hidden, ISNULL(data_type,'') data_type FROM yj_field
      WHERE panel_code='QC_OQC_REPORT' AND label IN (N'产品编码',N'单据编号',N'检验员',N'审核人',N'审核时间',N'审批人',N'审批时间')`)
  const fmap = Object.fromEntries(fRows.map((x) => [x.label, x]))
  r.check('T2[DB] 产品编码 yj_field.editable=1(可填)', fmap['产品编码'] && Number(fmap['产品编码'].editable) === 1,
    JSON.stringify(fmap['产品编码']))
  for (const label of ['单据编号', '检验员', '审核人', '审核时间', '审批人', '审批时间']) {
    r.check(`T2[DB] ${label} yj_field.editable=0(只读)`, fmap[label] && Number(fmap[label].editable) === 0,
      JSON.stringify(fmap[label]))
  }
  const cfg = (await cli.getJson('/api/px/getPanelConfig?panelCode=' + P)).data || {}
  const hf = Object.fromEntries((cfg.dataSchema?.fields || []).map((f) => [f.dataName, f]))
  r.check('T2[配置] getPanelConfig:产品编码 可编辑(readonly!=true)', hf['产品编码'] && hf['产品编码'].readonly !== true,
    JSON.stringify(hf['产品编码']))
  r.check('T2[配置] getPanelConfig:检验员/审核人/审批人 readonly=true',
    ['检验员', '审核人', '审批人'].every((k) => hf[k] && hf[k].readonly === true),
    ['检验员', '审核人', '审批人'].map((k) => k + '=' + (hf[k] && hf[k].readonly)).join(' '))
  r.fact('T2 getPanelConfig 抬头字段', (cfg.dataSchema?.fields || []).map((f) => ({ dataName: f.dataName, dataType: f.dataType, hidden: !!f.hidden, readonly: !!f.readonly })))

  /* ── ② 建 OQC 草稿(产品编码必填:yj_field isRequired=true ⇒ 先给初始值,UI 再改成新值验"可填+落库") ── */
  const marker = RUN
  const INIT_PRODUCT_CODE = 'AUTO-INIT-' + RUN
  const { no, save: sv } = await createDraft(cli, P, { marker, headExtra: { 产品编码: INIT_PRODUCT_CODE } })
  docs.push({ panel: P, no, marker })
  r.check('T2 建出厂检验报告草稿(API 新增+保存)', !!no, '单号=' + no + ' save=' + JSON.stringify(sv).slice(0, 200))
  const pc0 = S(await headValue(db, P, no, '产品编码'))
  r.check('T2[DB] 草稿「产品编码」初始值已落库(必填字段)', pc0 === INIT_PRODUCT_CODE, 'DB值=' + JSON.stringify(pc0))
  r.fact('T2 产品编码必填现状', 'yj_field.isRequired=true → 新建保存必须给值;本用例验证"草稿态可改并落库",不验证"草稿可空"')
  const dCnt = (await db.one(`SELECT COUNT(*) n FROM qc_oqc_detail WHERE 单据编号='${no.replace(/'/g, "''")}'`)).n
  r.fact('T2 草稿明细行数', dCnt)

  /* ── ③ UI:控件形态 + 填产品编码 + 保存 ── */
  const uiPrefix = 'ui-t2-' + RUN
  console.log('\n── UI 用例 → ' + UI + ' ──')
  let uiExit = 0
  try {
    execFileSync(process.execPath, [UI,
      '--base', BASE, '--factory', FACTORY, '--panel', P, '--docNo', no,
      '--task', 't2-oqc-draft', '--fill', JSON.stringify({ 产品编码: UI_PRODUCT_CODE }), '--save',
      '--out', OUT, '--prefix', uiPrefix], { cwd: ROOT, stdio: 'inherit' })
  } catch (e) { uiExit = typeof e.status === 'number' ? e.status : 1 }
  r.check('T2[UI] UI 子进程全部断言通过', uiExit === 0, 'exit=' + uiExit + ' 证据=' + path.join(OUT, uiPrefix + '.json'))

  /* ── ④ DB 落值断言 ── */
  const pc1 = S(await headValue(db, P, no, '产品编码'))
  r.check('T2[DB] UI 输入「产品编码」并保存后落库', pc1 === UI_PRODUCT_CODE, 'DB值=' + JSON.stringify(pc1) + ' 期望=' + UI_PRODUCT_CODE)

  /* ── ⑤ 可填清单与需求比对(从 UI 证据 JSON 读回) ── */
  let uiJson = null
  try { uiJson = JSON.parse(fs.readFileSync(path.join(OUT, uiPrefix + '.json'), 'utf8')) } catch { /* ignore */ }
  const uiFacts = (uiJson?.items || []).find((i) => i.name === '出厂检验报告纸面事实')
  if (uiFacts) {
    const f = JSON.parse(uiFacts.detail)
    const heads = f.heads || {}
    const fillable = Object.entries(heads).filter(([, v]) => ['input', 'number', 'date'].includes(v.kind)).map(([k]) => k)
    const readonly = Object.entries(heads).filter(([, v]) => v.kind === 'text').map(([k]) => k)
    r.fact('T2[UI] 抬头可填字段清单', { fillable, readonly })
    r.check('T2[需求比对] 抬头可填 = 客户名/产品名称/产品规格/生产量/AQL/生产日期/检测日期(日期控件)',
      ['客户名', '产品名称', '产品规格', '生产量', 'AQL', '生产日期', '检测日期'].every((k) => fillable.includes(k)),
      '实际=' + fillable.join(','))
    r.check('T2[需求比对] 抬头只读 = 报告编号', readonly.includes('报告编号'), '只读=' + readonly.join(','))
    r.check('T2[需求比对] 审批区(检验员/审核/批准)在签署区为只读文本(无输入框)',
      f.signInputs === 0 && Array.isArray(f.sign) && f.sign.length === 3, JSON.stringify(f.sign))
    r.check('T2[需求比对] 明细/检验结论/备注/卫生安全 均可填',
      (f.gridInputs || 0) > 0 && (f.sumRow || 0) > 0 && (f.remarkRow || 0) > 0 && f.hygieneInputs === 15,
      `明细控件=${f.gridInputs} 结论=${f.sumRow} 备注=${f.remarkRow} 卫生=${f.hygieneInputs}`)
  } else {
    r.check('T2[UI] 读到纸面控件清单证据', false, '未找到 UI 证据 FACT')
  }

  /* ── ⑥ 清理 ── */
  const cl = await cleanupDocs(db, docs, OUT, 'cleanup-' + RUN)
  r.check('T2 清理:测试单 5 表 0 残留', cl.zero, JSON.stringify(cl.residue))
  r.check('T2 清理:AUTO_QCVER_ 标记 0 残留', Object.values(cl.autoResidue).every((n) => n === 0), JSON.stringify(cl.autoResidue))

  const summary = r.summary()
  summary.env = { base: BASE, factory: FACTORY, db: 'HSDZ_MES_TEST', run: RUN, docs, cleanup: cl }
  await saveJson(path.join(OUT, 't2-summary-' + RUN + '.json'), summary)
  await saveText(path.join(OUT, 't2-summary-' + RUN + '.txt'),
    summary.items.map((i) => `${i.ok === null ? 'FACT' : i.ok ? 'PASS' : 'FAIL'}  ${i.name}${i.detail ? '  -- ' + i.detail : ''}`).join('\n')
    + `\n\nRESULT: ${summary.result} (PASS ${summary.pass} / FAIL ${summary.fail})\n`)
  process.exitCode = summary.fail === 0 ? 0 : 1
} catch (e) {
  r.check('T2 编排过程未抛异常', false, String(e && e.stack || e).slice(0, 800))
  const summary = r.summary()
  await saveJson(path.join(OUT, 't2-summary-' + RUN + '-fatal.json'), summary).catch(() => {})
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
