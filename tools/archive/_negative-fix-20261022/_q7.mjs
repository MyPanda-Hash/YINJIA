/** 只读探针 ⑦:负入库流水(inh.数量<0)是谁写的 + 结存 vs 流水差额构成 */
import mssql from '../../../deploy/node_modules/mssql/index.js'

const db = process.env.QDB || 'HSDZ_MES'
const pool = await mssql.connect({ server: '127.0.0.1', port: 1433, database: db, user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } })
const q = async (s) => (await pool.request().query(s)).recordset
const line = (t) => console.log('\n=== ' + t + ' ===')

line('inh 负数量流水汇总')
for (const r of await q(`SELECT src, 单据类型 AS t, COUNT(*) AS n, CAST(SUM(数量) AS decimal(18,2)) AS qty,
                                MIN(ISNULL(asp_user1,'-')) AS u, MAX(ISNULL(asp_user1,'-')) AS u2,
                                CONVERT(varchar(10),MIN(单据日期),120) AS d1, CONVERT(varchar(10),MAX(单据日期),120) AS d2
                           FROM inh WHERE 数量 < 0 GROUP BY src, 单据类型 ORDER BY n DESC`))
  console.log(`   src=${String(r.src).padEnd(3)} ${String(r.t).padEnd(10)} ${String(r.n).padStart(4)}行 ${String(r.qty).padStart(12)} 人=${r.u}~${r.u2} ${r.d1}~${r.d2}`)

line('inh 负数量流水样例(15)')
for (const r of await q(`SELECT TOP 15 单据编号, 单据类型, CONVERT(varchar(10),单据日期,120) AS d, 物料编码, 仓库编码, ISNULL(批号,'(null)') AS lot,
                                CAST(数量 AS decimal(18,2)) AS qty, asp_user1, src, rid
                           FROM inh WHERE 数量 < 0 ORDER BY id DESC`))
  console.log(`   ${String(r.单据编号).padEnd(22)} ${String(r.单据类型).padEnd(10)} ${r.d} ${String(r.物料编码).padEnd(16)} ${String(r.仓库编码).padEnd(9)} ${String(r.lot).padEnd(12)} ${String(r.qty).padStart(9)} by=${r.asp_user1} src=${r.src} rid=${r.rid}`)

line('结存 vs 流水:逐键差额(按物料/仓/批号)')
const diffs = await q(`
  WITH f AS (
    SELECT RTRIM(物料编码) AS w, ISNULL(RTRIM(仓库编码),'') AS c, ISNULL(RTRIM(批号),'') AS l, SUM(数量) AS inq
      FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY RTRIM(物料编码), ISNULL(RTRIM(仓库编码),''), ISNULL(RTRIM(批号),'')
    UNION ALL
    SELECT RTRIM(物料编码), ISNULL(RTRIM(仓库编码),''), ISNULL(RTRIM(批号),''), -SUM(数量)
      FROM outh WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY RTRIM(物料编码), ISNULL(RTRIM(仓库编码),''), ISNULL(RTRIM(批号),'')
  ), n AS (SELECT w, c, l, SUM(inq) AS net FROM f GROUP BY w, c, l)
  SELECT k.wzdm, k.ckdm, ISNULL(k.lot_no,'') AS lot, CAST(k.yl AS decimal(18,2)) AS yl, n.net
    FROM kucun k LEFT JOIN n ON n.w = RTRIM(k.wzdm) AND n.c = ISNULL(RTRIM(k.ckdm),'') AND n.l = ISNULL(RTRIM(k.lot_no),'')
   WHERE ISNULL(k.asp_cancel,'N')<>'Y'`)
const bad = diffs.filter((r) => Math.abs(Number(r.yl) - Number(r.net ?? 0)) > 0.0001)
console.log(`   有结存的行 ${diffs.length};结存 != 流水净额的 ${bad.length} 行`)
for (const r of bad.slice(0, 15))
  console.log(`   ${String(r.wzdm).padEnd(15)} ${String(r.ckdm).padEnd(9)} lot=${String(r.lot || '(null)').padEnd(15)} 结存=${String(r.yl).padStart(9)} 流水净额=${String(r.net ?? 0).padStart(9)}`)

line('inh 期末/月结/期初单据抽样')
for (const r of await q(`SELECT 单据类型 AS t, src, COUNT(*) AS n, CAST(SUM(数量) AS decimal(18,2)) AS qty FROM inh GROUP BY 单据类型, src`))
  console.log(`   ${String(r.t).padEnd(10)} src=${String(r.src).padEnd(3)} ${String(r.n).padStart(5)}行 ${r.qty}`)

await pool.close()
