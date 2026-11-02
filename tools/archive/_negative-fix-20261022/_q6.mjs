/** 只读探针 ⑥:负结存行的构成(期初/入库/出库)+ 物料档案 */
import mssql from '../../../deploy/node_modules/mssql/index.js'

const db = process.env.QDB || 'HSDZ_MES'
const pool = await mssql.connect({ server: '127.0.0.1', port: 1433, database: db, user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } })
const q = async (s) => (await pool.request().query(s)).recordset
const line = (t) => console.log('\n=== ' + t + ' ===')

line('bs_inv 列(物料档案)')
console.log('  ' + (await q(`SELECT COLUMN_NAME c, DATA_TYPE t, CHARACTER_MAXIMUM_LENGTH l FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='bs_inv' ORDER BY ORDINAL_POSITION`))
  .map((x) => `${x.c}:${x.t}${x.l > 0 ? '(' + x.l + ')' : ''}`).join('  '))
for (const r of await q(`SELECT TOP 3 * FROM bs_inv`)) console.log('   ' + JSON.stringify(r).slice(0, 600))

line('负结存行的流水构成')
const rows = await q(`
  SELECT k.wzdm, k.ckdm, ISNULL(k.lot_no,'') AS lot, CAST(k.yl AS decimal(18,2)) AS yl,
         ISNULL(inb.入库,0) AS inq, ISNULL(outb.出库,0) AS outq
    FROM kucun k
    OUTER APPLY (SELECT SUM(x.数量) AS 入库 FROM inh x WHERE ISNULL(x.asp_cancel,'N')<>'Y'
                  AND RTRIM(x.物料编码)=RTRIM(k.wzdm) AND ISNULL(RTRIM(x.仓库编码),'')=ISNULL(RTRIM(k.ckdm),'')
                  AND ISNULL(RTRIM(x.批号),'')=ISNULL(RTRIM(k.lot_no),'')) inb
    OUTER APPLY (SELECT SUM(x.数量) AS 出库 FROM outh x WHERE ISNULL(x.asp_cancel,'N')<>'Y'
                  AND RTRIM(x.物料编码)=RTRIM(k.wzdm) AND ISNULL(RTRIM(x.仓库编码),'')=ISNULL(RTRIM(k.ckdm),'')
                  AND ISNULL(RTRIM(x.批号),'')=ISNULL(RTRIM(k.lot_no),'')) outb
   WHERE ISNULL(k.asp_cancel,'N')<>'Y' AND ISNULL(k.yl,0)<-0.0001`)
console.log(`   负结存 ${rows.length} 行`)
const noIn = rows.filter((r) => Number(r.inq) === 0)
const hasIn = rows.filter((r) => Number(r.inq) !== 0)
console.log(`   其中「无入库流水」(只有出库):${noIn.length} 行;有入库流水但不够:${hasIn.length} 行`)
for (const r of rows.slice(0, 12))
  console.log(`   ${String(r.wzdm).padEnd(15)} ${String(r.ckdm).padEnd(9)} lot=${String(r.lot || '(null)').padEnd(15)} 结存=${String(r.yl).padStart(9)} 入=${String(r.inq).padStart(9)} 出=${String(r.outq).padStart(9)}`)

line('负结存行对应的物料是否在档案里')
for (const r of await q(`SELECT COUNT(*) AS miss FROM kucun k WHERE ISNULL(k.asp_cancel,'N')<>'Y' AND ISNULL(k.yl,0)<-0.0001
                          AND NOT EXISTS (SELECT 1 FROM bs_inv b WHERE b.存货编码=k.wzdm)`))
  console.log('   档案缺失行数: ' + r.miss)

await pool.close()
