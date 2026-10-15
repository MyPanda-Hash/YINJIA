/**
 * 恢复被软删的来料检验单 + 对应的检验数据记录(2026-10-16,正式库)
 *
 * 用户口径:「检验单我只看到了43张,如果你说的158张都是9.1后采购订单流转下来的,需要补齐,
 *            还有对应的检验目录与检验数据记录也是一样」。
 * 背景:qc_insp 162 张里 119 张被**平台软删**(yj_doc_status.canceled='Y',删者 admin,时间 9/18~9/20,
 *   即试运行期间删的);其中 118 张可溯源到 9/1 后的采购订单。
 * 做法:只把**可溯源**的那批软删标记清掉(canceled='N' + 清删者/删除时间),使其在界面重新出现;
 *   不可溯源的 1 张保持删除。检验数据记录按其备注关联的检验单同口径恢复。
 * ⚠ 平台无"恢复"接口,只能改 yj_doc_status(改前整行备份)。
 *
 * 用法: node tools/archive/_restore-insp-1016.mjs [--dry]
 */
import mssql from '../../deploy/node_modules/mssql/index.js'
import { writeFileSync } from 'node:fs'

const DRY = process.argv.includes('--dry')
const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true },
})
const q = async (s) => (await pool.request().query(s)).recordset

// ① 可溯源且被软删的检验单
const insps = await q(`
  SELECT i.单据编号 AS no FROM qc_insp i
  JOIN yj_doc_status s ON s.panel_code='QC_INSP' AND s.doc_no=i.单据编号 AND ISNULL(s.canceled,'N')='Y'
  JOIN sl_recv sl ON sl.单据编号=i.暂收单号
  JOIN bd_pu_order o ON o.单据编号=sl.采购订单号 AND o.单据日期 >= '2026-09-01'`)
// ② 这些检验单对应的检验数据记录(按备注里的 IJ 号关联)同口径恢复
const recs = await q(`
  SELECT r.单据编号 AS no FROM qc_insp_rec r
  JOIN yj_doc_status s ON s.panel_code='QC_INSP_REC' AND s.doc_no=r.单据编号 AND ISNULL(s.canceled,'N')='Y'
  WHERE r.备注 LIKE N'%IJ-%' AND EXISTS (
    SELECT 1 FROM qc_insp i JOIN sl_recv sl ON sl.单据编号=i.暂收单号
    JOIN bd_pu_order o ON o.单据编号=sl.采购订单号 AND o.单据日期>='2026-09-01'
    WHERE i.单据编号 = SUBSTRING(r.备注, CHARINDEX('IJ-', r.备注), 16))`)
console.log(`待恢复:检验单 ${insps.length} 张 / 检验数据记录 ${recs.length} 条`)
if (DRY) { insps.slice(0, 5).forEach((x) => console.log('   ' + x.no)); process.exit(0) }

const bak = []
for (const [panel, list] of [['QC_INSP', insps], ['QC_INSP_REC', recs]]) {
  for (const x of list) {
    const r = (await q(`SELECT * FROM yj_doc_status WHERE panel_code='${panel}' AND doc_no=N'${x.no.replace(/'/g, "''")}'`))[0]
    if (r) bak.push(JSON.stringify(r))
    await pool.request().query(
      `UPDATE yj_doc_status SET canceled='N', cancel_by=NULL, cancel_at=NULL
       WHERE panel_code='${panel}' AND doc_no=N'${x.no.replace(/'/g, "''")}'`)
  }
}
writeFileSync(new URL('./_dump-out/insp-restore-backup-1016.jsonl', import.meta.url), bak.join('\n'), 'utf8')

// 复核:界面口径可见数
for (const r of await q(`
  SELECT CASE WHEN ISNULL(s.canceled,'N')='Y' THEN N'已软删' ELSE N'界面可见' END AS 可见性,
         CASE WHEN o.单据编号 IS NOT NULL AND o.单据日期>='2026-09-01' THEN N'可溯源' ELSE N'不可溯源' END AS 溯源,
         COUNT(*) AS n
  FROM qc_insp i LEFT JOIN yj_doc_status s ON s.panel_code='QC_INSP' AND s.doc_no=i.单据编号
  LEFT JOIN sl_recv sl ON sl.单据编号=i.暂收单号 LEFT JOIN bd_pu_order o ON o.单据编号=sl.采购订单号
  GROUP BY CASE WHEN ISNULL(s.canceled,'N')='Y' THEN N'已软删' ELSE N'界面可见' END,
           CASE WHEN o.单据编号 IS NOT NULL AND o.单据日期>='2026-09-01' THEN N'可溯源' ELSE N'不可溯源' END
  ORDER BY 可见性, 溯源`)) console.log('   复核: ' + JSON.stringify(r))
await pool.close()
console.log('[备份] tools/archive/_dump-out/insp-restore-backup-1016.jsonl')
