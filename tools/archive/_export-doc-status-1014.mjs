/**
 * 导出「单据状态留痕」(2026-10-14,正式库)—— 与 kingdee-data-1014 配套,供同事导入后界面状态正确
 *
 * 为什么必须单独导:界面/流程的状态**不是**物理列「单据状态」,而是 `yj_doc_status` **工作流派生**:
 *   shr 非空=已审核 / pending='Y'=审批中 / archived='Y'=已完成 / canceled='Y'=已作废 / stopped='Y'=已中止;
 *   两者都没有 = 草稿。只导单据表 ⇒ 同事导入后一律显示草稿(实测口径,与用户看到的"大部分草稿"同根因)。
 *
 * 导出范围:与 kingdee-data-1014 同批的单据(8 类同步单据)+ 本批生成的流转单据
 *   (送料暂收单 QC_RECV/SL-*、来料检验单 QC_INSP/IJ-*、检验数据记录 QC_INSP_REC/JYSJ-*)。
 *
 * 用法: node tools/archive/_export-doc-status-1014.mjs
 */
import mssql from '../../deploy/node_modules/mssql/index.js'
import { writeFileSync } from 'node:fs'

const OUT = new URL('./_dump-out/kingdee-data-1014/', import.meta.url)
const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true },
})

const cell = (v) => {
  if (v === null || v === undefined) return ''
  let s = v instanceof Date ? v.toISOString().replace('T', ' ').slice(0, 19) : String(v)
  if (/[",\r\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"'
  return s
}

// 8 类同步单据 + 本批流转单据(按面板 + 单号前缀圈定)
const SCOPE = `
  (s.panel_code IN ('PU_ORDER','SO_ORDER','PURCHASE_IN','SALE_OUT','MATERIAL_OUT','FINISH_IN','OTHER_IN','OTHER_OUT')
    AND s.doc_no IN (
      SELECT 单据编号 FROM bd_pu_order WHERE asp_user1=N'金蝶拉取' UNION SELECT 单据编号 FROM bd_so_order WHERE asp_user1=N'金蝶拉取'
      UNION SELECT 单据编号 FROM bd_purchase_in WHERE asp_user1=N'金蝶拉取' UNION SELECT 单据编号 FROM bd_sale_out WHERE asp_user1=N'金蝶拉取'
      UNION SELECT 单据编号 FROM bd_material_out WHERE asp_user1=N'金蝶拉取' UNION SELECT 单据编号 FROM bd_finish_in WHERE asp_user1=N'金蝶拉取'
      UNION SELECT 单据编号 FROM bd_other_in WHERE asp_user1=N'金蝶拉取' UNION SELECT 单据编号 FROM bd_other_out WHERE asp_user1=N'金蝶拉取'))
  OR (s.panel_code = 'QC_RECV' AND s.doc_no LIKE 'SL-2026-10-%')
  OR (s.panel_code = 'QC_INSP' AND s.doc_no LIKE 'IJ-2026-10-%')
  OR (s.panel_code = 'QC_INSP_REC' AND s.doc_no LIKE 'JYSJ-2026-10-%')`

const rows = (await pool.request().query(
  `SELECT s.panel_code, s.doc_no, s.shr, s.shsj, s.pending, s.pending_by, s.pending_at, s.canceled, s.cancel_by, s.cancel_at,
          s.archived, s.archived_at, s.stopped, s.stop_by, s.stop_at, s.saved, s.erp_close_state, s.approve_node, s.l2_approver,
          CASE WHEN ISNULL(s.shr,'')<>'' THEN N'已审核' WHEN ISNULL(s.pending,'N')='Y' THEN N'审批中'
               WHEN ISNULL(s.canceled,'N')='Y' THEN N'已作废' WHEN ISNULL(s.archived,'N')='Y' THEN N'已完成'
               WHEN ISNULL(s.stopped,'N')='Y' THEN N'已中止' ELSE N'草稿' END AS 派生状态
   FROM yj_doc_status s WHERE ${SCOPE}`)).recordset
await pool.close()

if (!rows.length) { console.log('无留痕可导'); process.exit(0) }
const cols = Object.keys(rows[0])
const csv = [cols.join(',')].concat(rows.map((r) => cols.map((c) => cell(r[c])).join(','))).join('\r\n') + '\r\n'
writeFileSync(new URL('yj_doc_status.csv', OUT), csv, 'utf8')
const byPanel = {}
for (const r of rows) byPanel[r.panel_code] = (byPanel[r.panel_code] || 0) + 1
console.log(`yj_doc_status 留痕 ${rows.length} 行 / ${(Buffer.byteLength(csv, 'utf8') / 1024).toFixed(0)} KB`)
for (const [p, n] of Object.entries(byPanel).sort()) console.log(`   ${p.padEnd(14)} ${n}`)

// README 追加一节(说明状态怎么随数据走)
import { readFileSync, appendFileSync } from 'node:fs'
const rp = new URL('README.md', OUT)
try {
  appendFileSync(rp, ['', '## 单据状态(必须一起导,否则界面显示草稿)', '',
    "- 界面/流程状态**不是**物理列「单据状态」,而是**工作流派生** —— 真源表 `yj_doc_status`:",
    "  `shr` 非空=已审核 / `pending=Y`=审批中 / `canceled=Y`=已作废 / `archived=Y`=已完成 / `stopped=Y`=已中止;都没有=草稿。",
    '- 本目录 `yj_doc_status.csv` 即这批单据的留痕(含 `派生状态` 列便于核对),导库时一并写入 `yj_doc_status`;',
    '- 只导单据表不导留痕 ⇒ 同事侧一律显示「草稿」(与正式库表现不一致)。',
    `- 本次留痕行数:${rows.length}(${Object.entries(byPanel).map(([p, n]) => p + ':' + n).join(' / ')})`].join('\n'), 'utf8')
} catch (e) { console.log('README 追加失败:' + e.message) }
console.log('[产物] tools/archive/_dump-out/kingdee-data-1014/yj_doc_status.csv')
