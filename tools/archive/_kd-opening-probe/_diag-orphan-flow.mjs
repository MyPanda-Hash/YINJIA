/**
 * 核实「重复过账」:同 (单据编号, 物料) 在 inh 里有多行,其中一部分 rid 指向**已不存在的单据行**
 */
import mssql from '../../../deploy/node_modules/mssql/index.js'

const pool = await mssql.connect({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } })
const q = async (s) => (await pool.request().query(s)).recordset

console.log('=== ① 流水行的 rid 是否还能在对应单据行表里找到 ===')
const a = (await q(`
  SELECT
    SUM(CASE WHEN 孤儿=1 THEN 1 ELSE 0 END) AS 孤儿行,
    COUNT(*) AS 总行数
  FROM (
    SELECT 1 AS 孤儿 FROM inh i
     WHERE ISNULL(i.asp_cancel,'N')<>'Y' AND i.src=1
       AND NOT EXISTS (SELECT 1 FROM bl_purchase_in l WHERE l.id=i.rid)
    UNION ALL
    SELECT 1 FROM inh i
     WHERE ISNULL(i.asp_cancel,'N')<>'Y' AND i.src=2
       AND NOT EXISTS (SELECT 1 FROM bl_finish_in l WHERE l.id=i.rid)
  ) t`))[0]
console.log(`   入库流水孤儿行 ${a.孤儿行} / 总 ${a.总行数}`)

const b = (await q(`
  SELECT SUM(CASE WHEN 孤儿=1 THEN 1 ELSE 0 END) AS 孤儿行, COUNT(*) AS 总行数 FROM (
    SELECT 1 AS 孤儿 FROM outh o
     WHERE ISNULL(o.asp_cancel,'N')<>'Y'
       AND NOT EXISTS (SELECT 1 FROM bl_sale_out l WHERE l.id=o.rid)
       AND NOT EXISTS (SELECT 1 FROM bl_material_out l WHERE l.id=o.rid)
       AND NOT EXISTS (SELECT 1 FROM bl_other_out l WHERE l.id=o.rid)
  ) t`))[0]
console.log(`   出库流水孤儿行 ${b.孤儿行} / 总 ${b.总行数}`)

console.log('\n=== ② 孤儿流水行的来源(asp_user1)统计 ===')
const c = await q(`
  SELECT ISNULL(asp_user1,'(空)') AS u1, COUNT(*) AS n, CAST(SUM(数量) AS decimal(18,2)) AS q
    FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y' AND src=1
     AND NOT EXISTS (SELECT 1 FROM bl_purchase_in l WHERE l.id = inh.rid)
   GROUP BY asp_user1 ORDER BY COUNT(*) DESC`)
for (const r of c) console.log(`   ${String(r.u1).padEnd(22)} ${String(r.n).padStart(5)} 行 / ${r.q}`)

console.log('\n=== ③ 同一业务单被记两次的证据(抽 5 组)===')
const d = await q(`
  SELECT TOP 5 i.单据编号, i.物料编码,
         (SELECT COUNT(*) FROM inh x WHERE x.单据编号=i.单据编号 AND x.物料编码=i.物料编码 AND ISNULL(x.asp_cancel,'N')<>'Y') AS 流水行数,
         (SELECT COUNT(*) FROM bl_purchase_in l WHERE l.单据编号=i.单据编号 AND l.存货编码=i.物料编码) AS 单据行数
    FROM inh i WHERE ISNULL(i.asp_cancel,'N')<>'Y' AND i.src=1
   GROUP BY i.单据编号, i.物料编码 HAVING COUNT(*) > 1`)
for (const r of d) console.log(`   ${String(r.单据编号).padEnd(22)} ${String(r.物料编码).padEnd(14)} 流水行=${r.流水行数} 单据行=${r.单据行数}`)
await pool.close()
