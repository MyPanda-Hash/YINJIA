/**
 * _e2e-t1.mjs —— 需求 T1:制程检验单(QC_PROC_INSP)字段改造 端到端验证
 *
 * 验收点(需求原文):
 *   1) 表头「工序」从界面删除(元数据 hidden,物理数据保留)
 *   2) 「检验方案」固定显示 / 落库 = 「出货控制计划执行」
 *   3) 明细「结果判断」改为下拉,选项 合格/不合格
 *
 * 验证方式(8091 新代码 + 测试库 HSDZ_MES_TEST):
 *   · getPanelConfig 下发契约 + yj_field 台账 + 物理列/历史数据
 *   · API 建草稿并保存(载荷里故意塞 检验方案='错误值' → 断言落库被强制成固定值)
 *   · Playwright 打开纸张:表头无工序、检验方案只读固定文本、结果判断是 el-select
 *     → 选「不合格」→ 点侧栏「保存」→ DB 断言 qc_proc_insp_detail.结果判断 落值
 *   · 按单号白名单清理(DB_NAME() 硬闸门)并复核 0 残留
 *
 * 用法:node tools/archive/_qc-insp-verify-20261106/_e2e-t1.mjs [--base http://127.0.0.1:8091]
 * 产物:evidence/t1/
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import {
  Results, ROOT, login, api, okCall, saveJson, saveText, nowStamp, evidenceDir, sleep, xlsxText, norm,
} from './_lib.mjs'
import {
  PANEL, parseArgs, openTestDb, createDraft, cleanupDocs, docStatus, headValue, S, sweepResidue,
} from './_e2e-common.mjs'

const { arg } = parseArgs()
const BASE = String(arg('base', 'http://127.0.0.1:8091')).replace(/\/$/, '')
const FACTORY = 'YJ_TEST'
const STAMP = nowStamp()
const RUN = STAMP
const OUT = evidenceDir('t1')
const UI = path.join(ROOT, 'tools/archive/_qc-insp-verify-20261106/_ui-verify.mjs')
const PANEL_CODE = 'QC_PROC_INSP'
const P = PANEL[PANEL_CODE]
const FIXED = '出货控制计划执行'
const r = new Results('T1 制程检验单字段改造 @ ' + BASE + ' run=' + RUN)
r.fact('参数', { base: BASE, factory: FACTORY, db: 'HSDZ_MES_TEST', run: RUN, outDir: OUT })
const docs = []
let db

function runUi(argv) {
  console.log('\n── UI 用例 → ' + argv.join(' ') + ' ──')
  let exit = 0
  try { execFileSync(process.execPath, argv, { cwd: ROOT, stdio: 'inherit' }) } catch (e) { exit = typeof e.status === 'number' ? e.status : 1 }
  return exit
}

try {
  db = await openTestDb()
  const { token, user } = await login(BASE, { factory: FACTORY })
  const cli = api(BASE, token)
  r.check('8091 登录成功(测试账套 YJ_TEST)', !!token, 'realName=' + (user.realName || '') + ' factory=' + (user.factory || ''))
  r.fact('admin 账号', { userName: user.userName, realName: user.realName, isAdmin: user.isAdmin })

  /* ── ① 契约:getPanelConfig + yj_field ── */
  const cfg = (await cli.getJson('/api/px/getPanelConfig?panelCode=' + PANEL_CODE)).data || {}
  const headerFields = cfg.dataSchema?.fields || []
  const detailFields = cfg.detail?.tabs?.[0]?.fields || []
  const findH = (n) => headerFields.find((f) => f.dataName === n)
  const findD = (n) => detailFields.find((f) => f.dataName === n)
  r.fact('getPanelConfig 表头字段', headerFields.map((f) => ({ dataName: f.dataName, dataType: f.dataType, hidden: !!f.hidden, readonly: !!f.readonly })))
  r.fact('getPanelConfig 明细字段', detailFields.map((f) => ({ dataName: f.dataName, dataType: f.dataType, options: f.options || null })))

  const gx = findH('工序')
  r.check('T1[配置] dataSchema.fields 中「工序」不可见(hidden=true 或未下发)', !gx || gx.hidden === true,
    '字段=' + JSON.stringify(gx))
  const plan = findH('检验方案')
  const planReadonly = !!plan && (plan.readonly === true || plan.editable === false || plan.editable === 0)
  r.check('T1[配置] 「检验方案」只读(readonly=true)', planReadonly, '字段=' + JSON.stringify(plan))
  const verdictCfg = findD('结果判断')
  r.check('T1[配置] 明细「结果判断」dataType=下拉框', !!verdictCfg && verdictCfg.dataType === '下拉框',
    JSON.stringify(verdictCfg))
  const opts = Array.isArray(verdictCfg?.options) ? verdictCfg.options : []
  r.check('T1[配置] 「结果判断」options = 合格/不合格',
    opts.length === 2 && opts.includes('合格') && opts.includes('不合格'), JSON.stringify(opts))

  const fRows = await db.q(
    `SELECT label, data_type, editable, hidden, visible, ISNULL(dict_sql,'') dict_sql
       FROM yj_field WHERE panel_code='${PANEL_CODE}' AND label IN (N'工序',N'检验方案',N'结果判断')`)
  const fmap = Object.fromEntries(fRows.map((x) => [x.label, x]))
  r.check('T1[DB] yj_field:工序 hidden=1 且 visible=0',
    !!fmap['工序'] && Number(fmap['工序'].hidden) === 1 && Number(fmap['工序'].visible) === 0,
    JSON.stringify(fmap['工序']))
  r.check('T1[DB] yj_field:检验方案 editable=0',
    !!fmap['检验方案'] && Number(fmap['检验方案'].editable) === 0, JSON.stringify(fmap['检验方案']))
  r.check('T1[DB] yj_field:结果判断 data_type=下拉框 且 dict_sql 含 合格/不合格',
    !!fmap['结果判断'] && fmap['结果判断'].data_type === '下拉框'
    && S(fmap['结果判断'].dict_sql).includes('合格') && S(fmap['结果判断'].dict_sql).includes('不合格'),
    JSON.stringify(fmap['结果判断']))

  // 物理数据保留:工序 列存在 + 历史有值行数 > 0
  const colCnt = (await db.one("SELECT COUNT(*) n FROM sys.columns WHERE object_id=OBJECT_ID('dbo.qc_proc_insp_head') AND name=N'工序'")).n
  const gxRows = (await db.one("SELECT COUNT(*) n FROM qc_proc_insp_head WHERE LTRIM(RTRIM(ISNULL(工序,''))) <> ''")).n
  r.check('T1[DB] 物理列 qc_proc_insp_head.工序 保留', colCnt === 1, '列数=' + colCnt)
  r.check('T1[DB] 历史「工序」数据保留(有值行数>0)', gxRows > 0, '有值行数=' + gxRows)
  r.fact('T1 工序物理数据', { columnExists: colCnt, nonEmptyRows: gxRows })

  /* ── ② API 建草稿 + 保存:检验方案被强制固定值 ── */
  const marker = RUN
  const { no, save: sv } = await createDraft(cli, PANEL_CODE, { marker })
  docs.push({ panel: PANEL_CODE, no, marker })
  r.check('T1 建草稿(API 新增+保存)', !!no, '单号=' + no + ' save=' + JSON.stringify(sv).slice(0, 200))
  const planVal = S(await headValue(db, PANEL_CODE, no, '检验方案'))
  r.check('T1[API+DB] 保存时「检验方案」被强制写为「' + FIXED + '」(载荷故意传「错误值_应被覆盖」)',
    planVal === FIXED, 'DB值=' + JSON.stringify(planVal) + ' 载荷=错误值_应被覆盖')
  const dCnt = (await db.one(`SELECT COUNT(*) n FROM qc_proc_insp_detail WHERE 单据编号='${no.replace(/'/g, "''")}'`)).n
  r.check('T1[DB] 草稿明细行已落库(2 行)', dCnt === 2, '明细行=' + dCnt)
  const st0 = await docStatus(db, PANEL_CODE, no)
  r.check('T1[DB] 新建单为草稿(pending≠Y)', S(st0.pending) !== 'Y', JSON.stringify(st0))
  // 迁移回填 + 自动生单口径:全表(含自动生成的草稿)检验方案必须都是固定值
  const nonFixed = (await db.one(`SELECT COUNT(*) n FROM qc_proc_insp_head WHERE ISNULL(检验方案,'') <> N'${FIXED}'`)).n
  r.check('T1[DB] 全表(含历史/自动生成的草稿)「检验方案」非固定值行数 = 0', nonFixed === 0, '非固定值行数=' + nonFixed)

  /* ── ③ UI:纸张断言 + 选「不合格」+ 保存 ── */
  const uiPrefix = 'ui-t1-' + RUN
  const uiExit = runUi([UI,
    '--base', BASE, '--factory', FACTORY, '--panel', PANEL_CODE, '--docNo', no,
    '--task', 't1-proc-draft', '--fill', JSON.stringify({ 结果判断: '不合格' }), '--save', '--export-excel',
    '--out', OUT, '--prefix', uiPrefix])
  r.check('T1[UI] UI 子进程全部断言通过', uiExit === 0, 'exit=' + uiExit + ' 证据=' + path.join(OUT, uiPrefix + '.json'))
  // 前端纸张 Excel 导出:结果判断值正常(失败不影响主判据,但记 FAIL 需解释)
  try {
    const uiJson = JSON.parse(fs.readFileSync(path.join(OUT, uiPrefix + '.json'), 'utf8'))
    const exFact = (uiJson.items || []).find((i) => i.name === 'T1[UI] 纸张 Excel 导出证据')
    const ex = exFact ? JSON.parse(exFact.detail) : null
    if (ex?.downloadPath && fs.existsSync(ex.downloadPath)) {
      const xt = norm(xlsxText(ex.downloadPath))
      r.check('T1[UI] 纸张 Excel 里「结果判断」列与值正常(含 合格/不合格)',
        xt.includes('结果判断') && xt.includes('不合格') && xt.includes('合格'), '文本长度=' + xt.length)
      r.fact('T1 纸张 Excel 证据', path.relative(ROOT, ex.downloadPath))
    } else {
      r.check('T1[UI] 纸张 Excel 导出文件存在', false, JSON.stringify(ex).slice(0, 300))
    }
  } catch (e) {
    r.check('T1[UI] 解析纸张 Excel 导出证据', false, String(e.message).slice(0, 300))
  }

  /* ── ④ 保存后 DB 断言 ── */
  const dr = await db.one(
    `SELECT TOP 1 行号, 结果判断 FROM qc_proc_insp_detail WHERE 单据编号='${no.replace(/'/g, "''")}' ORDER BY 行号`)
  r.check('T1[DB] UI 选「不合格」保存后明细 结果判断 落值=不合格', !!dr && S(dr.结果判断) === '不合格',
    JSON.stringify(dr))
  const planVal2 = S(await headValue(db, PANEL_CODE, no, '检验方案'))
  r.check('T1[DB] UI 保存后「检验方案」仍为固定值', planVal2 === FIXED, 'DB值=' + JSON.stringify(planVal2))
  const gxNew = S(await headValue(db, PANEL_CODE, no, '工序'))
  r.fact('T1[DB] 本单工序值(界面已无该输入,物理列保留)', gxNew)

  /* ── ⑤ 清理 ── */
  const cl = await cleanupDocs(db, docs, OUT, 'cleanup-' + RUN)
  r.check('T1 清理:测试单 5 表 0 残留', cl.zero, JSON.stringify(cl.residue))
  r.check('T1 清理:AUTO_QCVER_ 标记 0 残留', Object.values(cl.autoResidue).every((n) => n === 0), JSON.stringify(cl.autoResidue))

  const summary = r.summary()
  summary.env = { base: BASE, factory: FACTORY, db: 'HSDZ_MES_TEST', run: RUN, docs, cleanup: cl }
  await saveJson(path.join(OUT, 't1-summary-' + RUN + '.json'), summary)
  await saveText(path.join(OUT, 't1-summary-' + RUN + '.txt'),
    summary.items.map((i) => `${i.ok === null ? 'FACT' : i.ok ? 'PASS' : 'FAIL'}  ${i.name}${i.detail ? '  -- ' + i.detail : ''}`).join('\n')
    + `\n\nRESULT: ${summary.result} (PASS ${summary.pass} / FAIL ${summary.fail})\n`)
  process.exitCode = summary.fail === 0 ? 0 : 1
} catch (e) {
  r.check('T1 编排过程未抛异常', false, String(e && e.stack || e).slice(0, 800))
  const summary = r.summary()
  await saveJson(path.join(OUT, 't1-summary-' + RUN + '-fatal.json'), summary).catch(() => {})
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
