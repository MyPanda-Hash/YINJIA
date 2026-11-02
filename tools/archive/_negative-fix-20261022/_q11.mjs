/** 只读探针 ⑪:预演暴露的三个问题 —— 虚假日期键、重复入库、档案缺失 */
import mssql from '../../../deploy/node_modules/mssql/index.js'

const db = process.env.QDB || 'HSDZ_MES'
const pool = await mssql.connect({ server: '127.0.0.1', port: 1433, database: db, user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } })
const q = async (s) => (await pool.request().query(s)).recordset
const line = (t) => console.log('\n=== ' + t + ' ===')

line('1900 / 2027 日期的流水(污染源,只看非期初)')
for (const r of await q(`SELECT * FROM (SELECT TOP 20 'inh' AS t, 单据编号, 单据类型, src, CONVERT(varchar(30),单据日期,120) AS ds, 物料编码, 仓库编码, ISNULL(批号,'(null)') AS lot,
                                CAST(数量 AS decimal(18,2)) AS qty, asp_user1
                           FROM inh WHERE (单据日期 < '2000-01-01' OR 单据日期 >= '2026-11-01') AND 单据类型 <> N'期初结存'
                          UNION ALL
                         SELECT TOP 20 'outh', 单据编号, 单据类型, src, CONVERT(varchar(30),单据日期,120), 物料编码, 仓库编码, ISNULL(批号,'(null)'),
                                CAST(数量 AS decimal(18,2)), asp_user1
                           FROM outh WHERE 单据日期 < '2000-01-01' OR 单据日期 >= '2026-11-01') z
                          ORDER BY ds`))
  console.log(`   [${r.t}] ${String(r.单据编号).padEnd(24)} ${String(r.单据类型).padEnd(10)} src=${r.src} ${r.ds} ${String(r.物料编码).padEnd(14)} ${String(r.仓库编码).padEnd(9)} ${String(r.lot).padEnd(14)} ${String(r.qty).padStart(10)} by=${r.asp_user1}`)

line('污染日期涉及哪些负结存键')
for (const r of await q(`SELECT DISTINCT k.wzdm, k.ckdm, ISNULL(k.lot_no,'(null)') AS lot, CAST(k.yl AS decimal(18,4)) AS yl,
                                (SELECT MAX(CONVERT(varchar(10),o.单据日期,120)) FROM outh o WHERE RTRIM(o.物料编码)=RTRIM(k.wzdm)
                                  AND ISNULL(RTRIM(o.仓库编码),'')=ISNULL(RTRIM(k.ckdm),'') AND ISNULL(o.asp_cancel,'N')<>'Y') AS last_out
                           FROM kucun k WHERE ISNULL(k.asp_cancel,'N')<>'Y' AND ISNULL(k.yl,0)<-0.0001`))
  if (r.last_out && (r.last_out < '2026-09-01' || r.last_out > '2026-10-31'))
    console.log(`   ${String(r.wzdm).padEnd(15)} ${String(r.ckdm).padEnd(9)} lot=${String(r.lot).padEnd(12)} 结存=${String(r.yl).padStart(10)} 最后一笔出库=${r.last_out}`)

line('重复入库风险:同一 (物料,仓库,批号) 的入库流水清单')
const dup = await q(`
  SELECT RTRIM(物料编码) AS w, ISNULL(RTRIM(仓库编码),'') AS c, ISNULL(RTRIM(批号),'') AS l,
         COUNT(*) AS n, CAST(SUM(数量) AS decimal(18,4)) AS inq
    FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(单据类型,'')<>N'月结结转'
   GROUP BY RTRIM(物料编码), ISNULL(RTRIM(仓库编码),''), ISNULL(RTRIM(批号),'')`)
const neg = await q(`SELECT RTRIM(wzdm) AS w, ISNULL(RTRIM(ckdm),'') AS c, ISNULL(RTRIM(lot_no),'') AS l, CAST(yl AS decimal(18,4)) AS yl
                       FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(yl,0)<-0.0001`)
const dm = new Map(dup.map((r) => [`${r.w}|${r.c}|${r.l}`, r]))
console.log(`   负结存行中「已有入库流水」的:${neg.filter((r) => dm.has(`${r.w}|${r.c}|${r.l}`)).length} 行`)
console.log('   其中「已有入库流水但入库合计恰好等于补货后余额」的(疑似重复入库):')
let doubleCount = 0
for (const r of neg) {
  const d = dm.get(`${r.w}|${r.c}|${r.l}`)
  if (!d) continue
  const target = Number(d.inq) + Number(r.yl)
  if (Math.abs(target - Number(d.inq)) < 0.0001 && Number(d.inq) > 0) { doubleCount++; if (doubleCount <= 10) console.log(`     ${r.w.padEnd(15)} ${r.c.padEnd(9)} lot=${r.l.padEnd(14)} 入库合计=${d.inq} 现结存=${r.yl}  补后=${target}`) }
}
console.log(`   合计疑似重复入库:${doubleCount} 行`)

line('档案缺失的物料明细')
for (const r of await q(`SELECT DISTINCT k.wzdm, k.ckdm, CAST(k.yl AS decimal(18,4)) AS yl
                           FROM kucun k WHERE ISNULL(k.asp_cancel,'N')<>'Y' AND ISNULL(k.yl,0)<-0.0001
                            AND NOT EXISTS (SELECT 1 FROM bs_inv b WHERE b.存货编码=k.wzdm)`))
  console.log(`   ${String(r.wzdm).padEnd(16)} ${String(r.ckdm).padEnd(10)} ${r.yl}`)

line('CK00001 仓库档案')
for (const r of await q(`SELECT * FROM bs_wh`)) console.log('   ' + JSON.stringify(r))
for (const r of await q(`SELECT DISTINCT 仓库编码, 仓库名称 FROM inh WHERE 仓库编码='CK00001' UNION SELECT DISTINCT 仓库编码, 仓库名称 FROM outh WHERE 仓库编码='CK00001'`))
  console.log('   流水里: ' + JSON.stringify(r))

line('TEST-MAT-A 是什么')
for (const r of await q(`SELECT DISTINCT 单据编号, 单据类型, CONVERT(varchar(10),单据日期,120) d, asp_user1, 数量 FROM inh WHERE 物料编码='TEST-MAT-A' UNION ALL SELECT DISTINCT 单据编号, 单据类型, CONVERT(varchar(10),单据日期,120), asp_user1, -数量 FROM outh WHERE 物料编码='TEST-MAT-A'`))
  console.log('   ' + JSON.stringify(r))

await pool.close()
