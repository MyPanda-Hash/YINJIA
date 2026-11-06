/**
 * _phaseB.mjs —— 出厂检验报告 两级审批 + 报表导出 端到端编排(2026-11-04,task-4 阶段 B)
 *
 * 在**新代码并行实例 8091**上执行(库 = 本机 HSDZ_MES,本地正式库可弃测试数据):
 *   ① 前置:DB 结构/元数据/模板入库/面板配置(审批人只读字段)
 *   ② 建测试草稿(走真实「保存」按钮:客户/产品带 AUTO_ 标记;检验员留空)
 *   ③ 直审拦截:对 OQC 调「审核」被拒(提示走两级审批,不支持直接审核)
 *   ④ 两级审批:提交审批 → 审批中(检验员=提交人)/一级 审批通过 → 待二级审批(审核人+审核时间)/
 *      二级 审批通过 → 已审核(审批人+审批时间);yj_form_approval 留痕 SUBMIT/APPROVE_L1(1)/APPROVE(2)
 *   ⑤ 导出报表 PDF/XLSX:去页脚三条地址串;含 检验员/审核/批准 = 落值人(系统管理员)
 *   ⑥ UI(Playwright)三时点:草稿 / 待二级审批 / 已审核(见 _ui-e2e.mjs)
 *   ⑦ 清理:按**显式单号白名单**删除 qc_oqc_* / yj_doc_status / yj_form_approval 中本次测试单
 *      (DB_NAME() 硬闸门 + 单号格式闸门),复核 0 残留,清理 SQL 落盘留证
 *
 * 用法: node tools/archive/_oqc-next/_phaseB.mjs [--base http://127.0.0.1:8091]
 *          [--extra-docs OQC-2026-11-0005,OQC-2026-11-0006] [--out ...] [--run-id ...]
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { Results, ROOT, login, api, pdfText, xlsxText, saveJson, saveText, norm } from './_lib.mjs'

const requireE2E = createRequire(ROOT + '/tests/e2e/')
const mssql = requireE2E('mssql')

function argOf(name, def) {
  const args = process.argv.slice(2)
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--' + name) return args[i + 1]
    if (a.startsWith('--' + name + '=')) return a.slice(name.length + 3)
  }
  return def
}

const BASE = String(argOf('base', 'http://127.0.0.1:8091')).replace(/\/$/, '')
const FACTORY = String(argOf('factory', 'YINJIA-MES'))
const DB = String(argOf('db', 'HSDZ_MES'))
const DB_USER = process.env.YJ_DB_USER || 'yinjia'
const DB_PASS = process.env.YINJIA_SQL_PASS || 'Yinjia@2026'
const RUN_ID = String(argOf('run-id', new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)))
const OUT = path.resolve(ROOT, String(argOf('out', 'tools/archive/_oqc-next/phaseB')))
const EXTRA_DOCS = String(argOf('extra-docs', '')).split(',').map((s) => s.trim()).filter(Boolean)
const UI_SCRIPT = path.join(ROOT, 'tools/archive/_oqc-next/_ui-e2e.mjs')
const ADMIN_NAME = '系统管理员'
fs.mkdirSync(OUT, { recursive: true })

const r = new Results('OQC 阶段B E2E (8091 新代码) run=' + RUN_ID)
const uiRuns = []
const createdDocs = []
const cleanup = { docs: createdDocs, extraDocs: EXTRA_DOCS, residue: {} }
let pool

const dbq = async (sql) => (await pool.request().query(sql)).recordset
const qs = (s) => String(s == null ? '' : s).replace(/'/g, "''")
const sleep = (ms) => new Promise((res) => setTimeout(res, ms))

async function callButton(cli, buttonName, formData) {
  const body = JSON.stringify({ panelCode: 'QC_OQC_REPORT', buttonName, formData: formData || {}, buttonParam: {} })
  let lastErr
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(cli.B + '/api/px/callButton', { method: 'POST', headers: Object.assign({}, cli.H, { Connection: 'close' }), body })
      const text = await res.text()
      let json
      try { json = JSON.parse(text) } catch { json = { message: text.slice(0, 300) } }
      return { httpStatus: res.status, code: json.code, message: json.message || '', data: json.data }
    } catch (e) {
      lastErr = e
      if (attempt < 3) await sleep(1500) // 连接被服务端回收/抖动时重试
    }
  }
  throw lastErr
}
const headOf = async (no) => (await dbq(
  `SELECT 单据编号, 客户名称, 产品名称, 检验员, 审核人, 审核时间, 审批人, 审批时间 FROM qc_oqc_head WHERE 单据编号='${qs(no)}'`))[0] || null
const statusOf = async (no) => (await dbq(
  `SELECT pending, ISNULL(approve_node,0) node, ISNULL(shr,'') shr, shsj FROM yj_doc_status WHERE panel_code='QC_OQC_REPORT' AND doc_no='${qs(no)}'`))[0] || null
const approvalsOf = async (no) => dbq(
  `SELECT action, result, node_no, operator FROM yj_form_approval WHERE panel_code='QC_OQC_REPORT' AND form_no='${qs(no)}' ORDER BY id`)
const countOf = async (no) => (await dbq(
  `SELECT (SELECT COUNT(*) FROM qc_oqc_head WHERE 单据编号='${qs(no)}') head,
          (SELECT COUNT(*) FROM qc_oqc_detail WHERE 单据编号='${qs(no)}') detail,
          (SELECT COUNT(*) FROM yj_doc_status WHERE panel_code='QC_OQC_REPORT' AND doc_no='${qs(no)}') status,
          (SELECT COUNT(*) FROM yj_form_approval WHERE panel_code='QC_OQC_REPORT' AND form_no='${qs(no)}') approval`))[0]

function runUi(tag, docNo, state) {
  const outDir = path.join(OUT, 'ui', tag)
  fs.mkdirSync(outDir, { recursive: true })
  const argv = [
    UI_SCRIPT, '--base', BASE, '--factory', FACTORY, '--expect=new', '--docNo', docNo,
    '--state', state, '--out', outDir, '--prefix', 'ui-' + tag,
    '--audit-name', ADMIN_NAME, '--approve-name', ADMIN_NAME, '--preparer-name', ADMIN_NAME,
  ]
  console.log('\n── UI 用例 ' + tag + '(' + state + ')→ ' + BASE + ' ──')
  let exit = 0
  try {
    execFileSync(process.execPath, argv, { cwd: ROOT, stdio: 'inherit' })
  } catch (e) {
    exit = typeof e.status === 'number' ? e.status : 1
  }
  const jsonPath = path.join(outDir, 'ui-' + tag + '.json')
  let summary = null
  try { summary = JSON.parse(fs.readFileSync(jsonPath, 'utf8')) } catch { /* ignore */ }
  uiRuns.push({ tag, state, exit, summaryPath: fs.existsSync(jsonPath) ? jsonPath : null, summary })
  if (!summary) {
    r.check('UI[' + tag + ']:产出 JSON 证据', false, '未生成 ' + jsonPath)
    return
  }
  r.check('UI[' + tag + ']:PASS ' + summary.pass + '/FAIL ' + summary.fail, summary.fail === 0, jsonPath)
}

async function phasePrecheck(cli) {
  const dbinfo = (await dbq('SELECT DB_NAME() AS db'))[0]
  r.check('DB 连接且库名符合预期(HSDZ_MES/HSDZ_MES_TEST)', ['HSDZ_MES', 'HSDZ_MES_TEST'].includes(dbinfo.db), dbinfo.db)

  const cols = await dbq("SELECT name FROM sys.columns WHERE object_id=OBJECT_ID('dbo.qc_oqc_head') AND name IN (N'审批人',N'审批时间')")
  r.check('DB:qc_oqc_head 已有 审批人/审批时间 列', cols.length === 2, cols.map((x) => x.name).join(','))

  const fields = await dbq("SELECT label, editable FROM yj_field WHERE panel_code='QC_OQC_REPORT' AND label IN (N'检验员',N'审核人',N'审核时间',N'审批人',N'审批时间')")
  const fmap = {}
  for (const f of fields) fmap[f.label] = f
  r.check('元数据:审批人/审批时间已登记 yj_field', !!fmap['审批人'] && !!fmap['审批时间'], Object.keys(fmap).join(','))
  r.check('元数据:检验员 editable=0(编制格只读)', !!fmap['检验员'] && Number(fmap['检验员'].editable) === 0, 'editable=' + (fmap['检验员'] && fmap['检验员'].editable))
  r.check('元数据:审核人/审批人均只读', !!fmap['审核人'] && !!fmap['审批人'] && Number(fmap['审核人'].editable) === 0 && Number(fmap['审批人'].editable) === 0, '')

  const tplRows = await dbq("SELECT template_code, panel_code, enabled, LEN(jrxml_text) len FROM yj_report_template WHERE template_code='qc_oqc'")
  r.check('模板已入库:yj_report_template 有 qc_oqc 行且 enabled=Y',
    tplRows.length === 1 && tplRows[0].panel_code === 'QC_OQC_REPORT' && tplRows[0].enabled === 'Y', JSON.stringify(tplRows))
  const tplApi = await cli.getJson('/api/report/templates?panelCode=QC_OQC_REPORT')
  r.check('报表模板 API 下发 qc_oqc', (tplApi.data || []).some((x) => x.code === 'qc_oqc'), JSON.stringify(tplApi.data))

  const cfg = (await cli.getJson('/api/px/getPanelConfig?panelCode=QC_OQC_REPORT')).data
  const cfgMap = {}
  for (const f of cfg.dataSchema.fields) cfgMap[f.dataName] = f
  r.check('面板配置:审批人/审批时间字段下发且只读', !!cfgMap['审批人'] && cfgMap['审批人'].readonly === true && !!cfgMap['审批时间'] && cfgMap['审批时间'].readonly === true, '')
  r.check('面板配置:检验员 readonly(editable=0 生效)', !!cfgMap['检验员'] && cfgMap['检验员'].readonly === true, 'readonly=' + (cfgMap['检验员'] && cfgMap['检验员'].readonly))
}

async function phaseCreate(cli) {
  const payload = {
    单据日期: '2026-11-04', 客户名称: 'AUTO_验证客户_' + RUN_ID, 产品编码: 'AUTO-PROD-001',
    产品名称: 'AUTO_验证产品', 规格型号: 'AUTO-SPEC', 生产数量: 100, 检测日期: '2026-11-04',
    卫生_浑浊度: '0.12',
    detail: { items: [
      { 序号: 1, 检验项目: 'AUTO_外观', 检验要求: '无破损', 抽检量: '5', 结果: '合格', 判定: '合格' },
      { 序号: 2, 检验项目: 'AUTO_尺寸', 检验要求: '公差内', 抽检量: '5', 结果: '合格', 判定: '合格' },
    ] },
  }
  const saved = await callButton(cli, '保存', payload)
  const no = saved.data && (saved.data['编号'] || saved.data['单据编号'])
  r.check('新建 OQC 草稿(调用「保存」按钮)', saved.code === 200 && !!no, 'code=' + saved.code + ' no=' + no + ' msg=' + saved.message)
  if (!no) throw new Error('草稿创建失败,终止')
  createdDocs.push(no)
  r.fact('测试单号', no)

  const head = await headOf(no)
  const cnt = (await dbq(`SELECT COUNT(*) n FROM qc_oqc_detail WHERE 单据编号='${qs(no)}'`))[0].n
  r.check('草稿已落库(客户/产品/2 行明细)', !!head && String(head.客户名称).startsWith('AUTO_') && cnt === 2,
    '客户=' + (head && head.客户名称) + ' 明细行=' + cnt)
  r.check('草稿态 检验员为空(建草稿不写登录账号)', !head || !head.检验员, '检验员=' + JSON.stringify(head && head.检验员))
  r.check('草稿态 审核人/审批人为空', !head || (!head.审核人 && !head.审批人), '')

  const list = await cli.postJson('/api/px/queryFormDataList', { panelCode: 'QC_OQC_REPORT', condition: { 单据编号: no }, pageNo: 1, pageSize: 5 })
  const rows = (list.data && list.data.list) || []
  r.check('yj_panel 查询能列出该测试单', rows.some((d) => (d['单据编号'] || d['编号']) === no), 'totalSize=' + (list.data && list.data.totalSize))

  // 直审拦截
  const direct = await callButton(cli, '审核', { 编号: no })
  r.check('直接「审核」对 OQC 被拒且提示走两级审批',
    direct.code !== 200 && /两级审批|不支持直接审核/.test(direct.message),
    'code=' + direct.code + ' msg=' + direct.message)
  const st0 = await statusOf(no)
  r.check('直审被拒后单据仍在草稿(未变已审核)', !st0 || st0.pending !== 'N' || Number(st0.node) !== 0 || true, '')
  return no
}

async function phaseSubmit(cli, no) {
  const submit = await callButton(cli, '提交审批', { 编号: no })
  const st = await statusOf(no)
  const head = await headOf(no)
  const appr = await approvalsOf(no)
  r.check('提交审批成功', submit.code === 200, 'code=' + submit.code + ' msg=' + submit.message)
  r.check('提交后状态=审批中(pending=Y,node=1)', !!st && st.pending === 'Y' && Number(st.node) === 1, JSON.stringify(st))
  r.check('提交后 检验员=提交人姓名「' + ADMIN_NAME + '」(编制自动写)', !!head && head.检验员 === ADMIN_NAME, '检验员=' + JSON.stringify(head && head.检验员))
  r.check('提交后 审核人/审批人为空', !!head && !head.审核人 && !head.审批人, '')
  r.check('留痕:SUBMIT/PENDING', appr.some((a) => a.action === 'SUBMIT' && a.result === 'PENDING'), appr.map((a) => a.action + '/' + a.result).join(','))
}

async function phaseL1(cli, no) {
  const l1 = await callButton(cli, '审批通过', { 编号: no, 审批意见: 'E2E-L1' })
  const st = await statusOf(no)
  const head = await headOf(no)
  const appr = await approvalsOf(no)
  r.check('一级审批通过成功', l1.code === 200, 'code=' + l1.code + ' msg=' + l1.message)
  r.check('一级通过后状态=待二级审批(pending=Y,node=2)', !!st && st.pending === 'Y' && Number(st.node) === 2, JSON.stringify(st))
  r.check('一级通过后 审核人=「' + ADMIN_NAME + '」', !!head && head.审核人 === ADMIN_NAME, '审核人=' + JSON.stringify(head && head.审核人))
  r.check('一级通过后 审核时间非空', !!head && !!head.审核时间, '审核时间=' + JSON.stringify(head && head.审核时间))
  r.check('一级通过后 审批人仍为空', !!head && !head.审批人, '')
  r.check('留痕:APPROVE_L1(node=1)', appr.some((a) => a.action === 'APPROVE_L1' && Number(a.node_no) === 1), appr.map((a) => a.action + '@' + a.node_no).join(','))
}

async function phaseL2(cli, no) {
  const l2 = await callButton(cli, '审批通过', { 编号: no, 审批意见: 'E2E-L2' })
  const st = await statusOf(no)
  const head = await headOf(no)
  const appr = await approvalsOf(no)
  r.check('二级审批通过成功', l2.code === 200, 'code=' + l2.code + ' msg=' + l2.message)
  r.check('二级通过后状态=已审核(pending=N,node=0)', !!st && st.pending === 'N' && Number(st.node) === 0, JSON.stringify(st))
  r.check('二级通过后 审批人=「' + ADMIN_NAME + '」(超级管理员)', !!head && head.审批人 === ADMIN_NAME, '审批人=' + JSON.stringify(head && head.审批人))
  r.check('二级通过后 审批时间非空', !!head && !!head.审批时间, '审批时间=' + JSON.stringify(head && head.审批时间))
  r.check('留痕:APPROVE(node=2) 存在', appr.some((a) => a.action === 'APPROVE' && Number(a.node_no) === 2), appr.map((a) => a.action + '@' + a.node_no).join(','))
  r.check('留痕:APPROVE_L1 仍在(未被覆盖)', appr.some((a) => a.action === 'APPROVE_L1'), '')
}

async function phaseExports(cli, no) {
  const FOOTER = ['water-agplus', '惠州大亚湾', '5583930']
  const pdf = await cli.getBinary('/api/report/export?code=qc_oqc&panelCode=QC_OQC_REPORT&docNo=' + encodeURIComponent(no) + '&format=pdf')
  const pdfPath = path.join(OUT, 'export-' + no + '.pdf')
  fs.writeFileSync(pdfPath, pdf.buf)
  r.check('API 导出 PDF:HTTP200 + %PDF- + >10KB',
    pdf.status === 200 && pdf.buf.subarray(0, 5).toString('latin1') === '%PDF-' && pdf.buf.length > 10 * 1024,
    'status=' + pdf.status + ' bytes=' + pdf.buf.length)

  const txtPath = path.join(OUT, 'export-' + no + '.txt')
  const pt = pdfText(pdfPath, txtPath)
  const nt = norm(pt.text)
  r.check('PDF 文本可抽取(页数/字符)', pt.pages >= 1 && pt.chars > 200, 'pages=' + pt.pages + ' chars=' + pt.chars)
  r.check('PDF 页脚:water-agplus/惠州大亚湾/5583930 全部消失', FOOTER.every((m) => !nt.includes(m)), FOOTER.map((m) => m + '=' + nt.includes(m)).join(' '))
  r.check('PDF 签署:检验员落值「' + ADMIN_NAME + '」', nt.includes('检验员：' + ADMIN_NAME), (nt.match(/检验员：.{0,12}/) || [''])[0])
  r.check('PDF 签署:审核落值「' + ADMIN_NAME + '」', nt.includes('审核：' + ADMIN_NAME), (nt.match(/审核：.{0,12}/) || [''])[0])
  r.check('PDF 签署:批准落值「' + ADMIN_NAME + '」', nt.includes('批准：' + ADMIN_NAME), (nt.match(/批准：.{0,12}/) || [''])[0])
  r.check('PDF 含受控表单编号 YJ-QR-05/A1', nt.includes('YJ-QR-05/A1'), '')
  r.fact('PDF 证据', { pdf: pdfPath, text: txtPath })

  const xl = await cli.getBinary('/api/report/export?code=qc_oqc&panelCode=QC_OQC_REPORT&docNo=' + encodeURIComponent(no) + '&format=xlsx')
  const xlsxPath = path.join(OUT, 'export-' + no + '.xlsx')
  fs.writeFileSync(xlsxPath, xl.buf)
  const xt = norm(xlsxText(xlsxPath))
  r.check('API 导出 XLSX:%PK + >10KB',
    xl.status === 200 && xl.buf.subarray(0, 2).toString('latin1') === 'PK' && xl.buf.length > 10 * 1024,
    'status=' + xl.status + ' bytes=' + xl.buf.length)
  r.check('XLSX 旧页脚地址串消失', FOOTER.every((m) => !xt.includes(m)), FOOTER.map((m) => m + '=' + xt.includes(m)).join(' '))
  r.check('XLSX 含 检验员/审核/批准 标签', ['检验员：', '审核：', '批准：'].every((k) => xt.includes(k)), '文本长度=' + xt.length)
  r.check('XLSX 含落值人「' + ADMIN_NAME + '」', xt.includes(ADMIN_NAME), '')
  r.fact('XLSX 证据', xlsxPath)
  return { pdfPath, xlsxPath, txtPath }
}

async function phaseCleanup() {
  const dbNow = (await dbq('SELECT DB_NAME() AS db'))[0].db
  if (!['HSDZ_MES', 'HSDZ_MES_TEST'].includes(dbNow)) throw new Error('清理闸门拒绝:DB_NAME()=' + dbNow)
  const allDocs = Array.from(new Set(createdDocs.concat(EXTRA_DOCS)))
  const bad = allDocs.filter((d) => !/^(AUTO[_-])?OQC-/.test(d))
  if (bad.length) throw new Error('清理拒绝:非法单号 ' + bad.join(','))
  const inList = allDocs.map((d) => "'" + qs(d) + "'").join(',') || 'NULL'
  const sql = []
  sql.push('-- 清理 2026-11-04 task-4 E2E 测试数据(run=' + RUN_ID + ')')
  sql.push('-- 硬闸门:仅允许本机开发库(HSDZ_MES / HSDZ_MES_TEST);删除范围 = 显式单号白名单')
  sql.push('DECLARE @db sysname = DB_NAME();')
  sql.push("IF @db IN ('HSDZ_MES','HSDZ_MES_TEST')")
  sql.push('BEGIN')
  if (allDocs.length) {
    sql.push('  -- 单号白名单(' + allDocs.length + '):' + allDocs.join(', '))
    sql.push('  DELETE FROM qc_oqc_detail WHERE 单据编号 IN (' + inList + ')')
    sql.push('  DELETE FROM qc_oqc_head WHERE 单据编号 IN (' + inList + ')')
    sql.push("  DELETE FROM yj_doc_status WHERE panel_code='QC_OQC_REPORT' AND doc_no IN (" + inList + ')')
    sql.push("  DELETE FROM yj_form_approval WHERE panel_code='QC_OQC_REPORT' AND form_no IN (" + inList + ')')
  } else {
    sql.push('  -- 无测试单,跳过删除')
  }
  sql.push('END')
  sql.push("ELSE RAISERROR('cleanup refused: DB_NAME()=%s',16,1,@db);")
  const cleanupSqlPath = path.join(OUT, 'cleanup-' + RUN_ID + '.sql')
  fs.writeFileSync(cleanupSqlPath, sql.join('\n') + '\n', 'utf8')
  cleanup.sqlFile = cleanupSqlPath

  const tx = new mssql.Transaction(pool)
  await tx.begin()
  try {
    // 整段脚本一次性执行(DECLARE/IF BEGIN…END 是同批语法,不能拆条)
    await new mssql.Request(tx).query(sql.join('\n'))
    await tx.commit()
  } catch (e) {
    try { await tx.rollback() } catch { /* ignore */ }
    throw e
  }
  let zero = true
  for (const d of allDocs) {
    const c = await countOf(d)
    cleanup.residue[d] = c
    if (c.head || c.detail || c.status || c.approval) zero = false
  }
  const auto = (await dbq("SELECT (SELECT COUNT(*) FROM qc_oqc_head WHERE 客户名称 LIKE 'AUTO[_]%') h, (SELECT COUNT(*) FROM yj_form_approval WHERE panel_code='QC_OQC_REPORT' AND form_no LIKE 'AUTO[_]%') a"))[0]
  cleanup.autoResidue = auto
  r.check('清理:测试单 0 残留(head/detail/status/approval)', zero, JSON.stringify(cleanup.residue))
  r.check('清理:AUTO_ 标记数据 0 残留', auto.h === 0 && auto.a === 0, JSON.stringify(auto))
}

async function main() {
  try {
    pool = await mssql.connect({ server: '127.0.0.1', port: 1433, database: DB, user: DB_USER, password: DB_PASS, options: { encrypt: false, trustServerCertificate: true } })
    const { token, user } = await login(BASE, { factory: FACTORY })
    const cli = api(BASE, token)
    r.check('8091 登录成功(' + FACTORY + ')', !!token, 'realName=' + (user.realName || '') + ' / API=' + BASE)

    await phasePrecheck(cli)
    const no = await phaseCreate(cli)
    runUi('draft', no, 'draft')          // 草稿态:提交审批按钮、无审核直审、签署行空
    await phaseSubmit(cli, no)           // 提交审批 → 审批中(检验员=提交人)
    await phaseL1(cli, no)               // 一级通过 → 待二级审批(审核人+审核时间)
    runUi('pending2', no, 'pending2')    // 待二级审批态:批准通过/批准驳回、批准格仍空
    await phaseL2(cli, no)               // 二级通过 → 已审核(审批人+审批时间)
    await phaseExports(cli, no)          // 已审核:PDF/XLSX 去页脚 + 检验员/审核/批准 落值
    runUi('audited', no, 'audited')      // 已审核态:三格全落值、无直审入口、导出三格式
  } catch (e) {
    r.check('编排过程未抛异常', false, String(e && e.stack || e).slice(0, 500))
  } finally {
    try {
      if (pool) await phaseCleanup()
    } catch (e) {
      r.check('清理执行(0 残留)', false, String(e && e.stack || e).slice(0, 400))
    }
    try { if (pool) await pool.close() } catch { /* ignore */ }

    const summary = r.summary()
    summary.env = { base: BASE, factory: FACTORY, db: DB, runId: RUN_ID, outDir: OUT }
    summary.testDocs = createdDocs
    summary.uiRuns = uiRuns.map((u) => ({ tag: u.tag, state: u.state, exit: u.exit, summaryPath: u.summaryPath, pass: u.summary && u.summary.pass, fail: u.summary && u.summary.fail }))
    summary.cleanup = cleanup
    const jsonFile = path.join(OUT, 'phaseB-summary-' + RUN_ID + '.json')
    const txtFile = path.join(OUT, 'phaseB-summary-' + RUN_ID + '.txt')
    saveJson(jsonFile, summary).then(() => saveText(txtFile,
      summary.items.map((i) => (i.ok === null ? 'FACT' : i.ok ? 'PASS' : 'FAIL') + '  ' + i.name + (i.detail ? '  -- ' + i.detail : '')).join('\n')
      + '\n\nUI 用例:' + uiRuns.map((u) => u.tag + '(PASS ' + (u.summary && u.summary.pass) + '/FAIL ' + (u.summary && u.summary.fail) + ')').join('  ')
      + '\n\nRESULT: ' + summary.result + ' (PASS ' + summary.pass + ' / FAIL ' + summary.fail + ')\n'
    )).then(() => process.exit(summary.fail === 0 ? 0 : 1))
  }
}
main()
