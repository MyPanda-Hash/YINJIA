/**
 * _db-probe.mjs —— 出厂检验报告(OQC)两级审批/报表模板 只读 DB 探针(2026-11-04,验证任务 task-4)
 *
 * 用途:
 *   ① 阶段 A 记录「改前基线」(旧代码/旧迁移下 qc_oqc_head 列、yj_doc_status 状态、yj_report_template 行);
 *   ② 阶段 B 复核「改后落库状态」(审批人/审批时间列、yj_form_approval 留痕、模板入库、测试单清理)。
 *
 * 只读纪律:本探针**只 SELECT / 读 INFORMATION_SCHEMA**,不做任何写操作。
 * 库选择:环境变量 YJ_DB(缺省 HSDZ_MES);口令 YINJIA_SQL_PASS(缺省 Yinjia@2026,仅本机开发库)。
 *
 * 用法:
 *   node tools/archive/_oqc-next/_db-probe.mjs                 # 摘要(基线关注项)
 *   node tools/archive/_oqc-next/_db-probe.mjs --json          # 机器可读 JSON(供 E2E 脚本断言/落盘)
 *   YJ_DB=HSDZ_MES_TEST node tools/archive/_oqc-next/_db-probe.mjs
 */
import { createRequire } from 'node:module'

const require = createRequire('D:/workspace/yinjia/tests/e2e/')
const mssql = require('mssql')

const DB = process.env.YJ_DB || 'HSDZ_MES'
const HOST = process.env.YJ_DB_HOST || '127.0.0.1'
const PORT = Number(process.env.YJ_DB_PORT || 1433)
const USER = process.env.YJ_DB_USER || 'yinjia'
const PASS = process.env.YINJIA_SQL_PASS || 'Yinjia@2026'
const JSON_OUT = process.argv.includes('--json')

const pool = await mssql.connect({
  server: HOST, port: PORT, database: DB, user: USER, password: PASS,
  options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true },
})
const q = async (sql, params = {}) => {
  const req = pool.request()
  for (const [k, v] of Object.entries(params)) req.input(k, v)
  return (await req.query(sql)).recordset
}

/** 列是否存在 */
async function hasCol(table, col) {
  const r = await q(`SELECT 1 AS ok FROM sys.columns WHERE object_id = OBJECT_ID(@t) AND name = @c`,
    { t: 'dbo.' + table, c: col })
  return r.length > 0
}

const out = { db: DB, at: new Date().toISOString() }

// ── 1. qc_oqc_head 结构性关注列(审批人/审批时间 是本轮新增) ──
out.headCols = {}
for (const c of ['检验员', '审核人', '审核时间', '审批人', '审批时间']) {
  out.headCols[c] = await hasCol('qc_oqc_head', c)
}

// ── 2. 现有报告单(最近 10 张)+ 状态 ──
out.docs = await q(`
  SELECT TOP 10 h.单据编号, CONVERT(varchar(10), h.单据日期, 23) AS 单据日期,
         h.客户名称, h.产品名称, h.检验员, h.审核人, h.审核时间
  FROM qc_oqc_head h
  WHERE ISNULL(h.asp_cancel,'N') <> 'Y'
  ORDER BY h.单据编号 DESC`)

// ── 3. 单据状态(两级审批字段;yj_doc_status 无 status 列,status 由 pending/approve_node 等推导) ──
out.docStatus = await q(`
  SELECT panel_code, doc_no, pending, ISNULL(approve_node,0) AS approve_node,
         ISNULL(shr,'') AS shr, shsj, ISNULL(l2_approver,'') AS l2_approver, update_at
  FROM yj_doc_status
  WHERE panel_code = 'QC_OQC_REPORT'
  ORDER BY update_at DESC`)

// ── 4. 审批留痕(最近 20 条) ──
out.approvals = await q(`
  SELECT TOP 20 id, panel_code, form_no, action, result, node_no, ISNULL(operator,'') AS operator,
         ISNULL(opinion,'') AS opinion, CONVERT(varchar(23), create_time, 121) AS create_time
  FROM yj_form_approval
  WHERE panel_code = 'QC_OQC_REPORT'
  ORDER BY id DESC`)

// ── 5. 报表模板是否入库(DB 优先;task-3 会写 qc_oqc 行) ──
out.templates = await q(`
  SELECT template_code, panel_code, name, enabled, LEN(jrxml_text) AS len_jrxml,
         CONVERT(varchar(23), update_at, 121) AS update_at
  FROM yj_report_template
  WHERE panel_code = 'QC_OQC_REPORT' OR template_code = 'qc_oqc'`)

// ── 6. yj_field 注册(审批人/审批时间 新增;检验员 editable=0) ──
out.fields = await q(`
  SELECT id, label, place, seq, editable, required, hidden, visible
  FROM yj_field
  WHERE panel_code = 'QC_OQC_REPORT'
    AND label IN (N'检验员', N'审核人', N'审核时间', N'审批人', N'审批时间')
  ORDER BY seq, id`)

// ── 7. 测试数据残留(AUTO_ 前缀;阶段 B 收尾必须为 0) ──
out.autoResidue = await q(`
  SELECT
    (SELECT COUNT(*) FROM qc_oqc_head WHERE 单据编号 LIKE 'AUTO[_]%') AS oqc_head,
    (SELECT COUNT(*) FROM qc_oqc_detail WHERE 单据编号 LIKE 'AUTO[_]%') AS oqc_detail,
    (SELECT COUNT(*) FROM yj_doc_status WHERE panel_code = 'QC_OQC_REPORT' AND doc_no LIKE 'AUTO[_]%') AS doc_status,
    (SELECT COUNT(*) FROM yj_form_approval WHERE panel_code = 'QC_OQC_REPORT' AND form_no LIKE 'AUTO[_]%') AS approval`)

await pool.close()

if (JSON_OUT) {
  console.log(JSON.stringify(out, null, 1))
} else {
  console.log(`== DB=${out.db} @ ${out.at}`)
  console.log('[1] qc_oqc_head 关注列:', JSON.stringify(out.headCols))
  console.log(`[2] 报告单 ${out.docs.length} 张(最近):`)
  for (const d of out.docs) console.log('    ', JSON.stringify(d))
  console.log(`[3] yj_doc_status(QC_OQC_REPORT) ${out.docStatus.length} 行:`)
  for (const s of out.docStatus) console.log('    ', JSON.stringify(s))
  console.log(`[4] yj_form_approval 留痕 ${out.approvals.length} 条:`)
  for (const a of out.approvals) console.log('    ', JSON.stringify(a))
  console.log('[5] yj_report_template:', JSON.stringify(out.templates))
  console.log('[6] yj_field:', JSON.stringify(out.fields))
  console.log('[7] AUTO_ 残留:', JSON.stringify(out.autoResidue))
}
