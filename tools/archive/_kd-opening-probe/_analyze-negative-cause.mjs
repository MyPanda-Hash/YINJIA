/**
 * 负库存成因分析(只读) —— 把 357 行批次负结存逐行归因
 *
 * 分类法:
 *   A 同物料同仓合计为正(假负):拆成多批次后某一批为负,货在别的批上
 *   B 同物料同仓合计为负(真缺):总账就缺
 *       B1 该批有期初、但本批出库 > 期初 + 本批入库(出在别的批上)
 *       B2 该批无期初、无入库,只有出库(纯出库批)
 *       B3 其它
 */
import mssql from '../../../deploy/node_modules/mssql/index.js'

const pool = await mssql.connect({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } })
const q = async (s) => (await pool.request().query(s)).recordset

// ① 每个负结存键的构成:期初 / 入库 / 出库
const rows = await q(`
  SELECT k.wzdm, k.ckdm, ISNULL(k.lot_no,'') AS lot, k.yl AS 结存,
         ISNULL(p.期初,0) AS 期初,
         ISNULL(inb.入库,0) AS 入库,
         ISNULL(outb.出库,0) AS 出库,
         ISNULL(sib.同物料同仓合计,0) AS 同物料同仓合计
    FROM kucun k
    OUTER APPLY (SELECT SUM(数量) AS 期初 FROM inh x
                  WHERE x.src=0 AND ISNULL(x.asp_cancel,'N')<>'Y'
                    AND RTRIM(x.物料编码)=RTRIM(k.wzdm) AND ISNULL(RTRIM(x.仓库编码),'')=ISNULL(RTRIM(k.ckdm),'')
                    AND ISNULL(RTRIM(x.批号),'')=ISNULL(RTRIM(k.lot_no),'')) p
    OUTER APPLY (SELECT SUM(数量) AS 入库 FROM inh x
                  WHERE ISNULL(x.asp_cancel,'N')<>'Y' AND x.src BETWEEN 1 AND 8
                    AND RTRIM(x.物料编码)=RTRIM(k.wzdm) AND ISNULL(RTRIM(x.仓库编码),'')=ISNULL(RTRIM(k.ckdm),'')
                    AND ISNULL(RTRIM(x.批号),'')=ISNULL(RTRIM(k.lot_no),'')) inb
    OUTER APPLY (SELECT SUM(数量) AS 出库 FROM outh x
                  WHERE ISNULL(x.asp_cancel,'N')<>'Y'
                    AND RTRIM(x.物料编码)=RTRIM(k.wzdm) AND ISNULL(RTRIM(x.仓库编码),'')=ISNULL(RTRIM(k.ckdm),'')
                    AND ISNULL(RTRIM(x.批号),'')=ISNULL(RTRIM(k.lot_no),'')) outb
    OUTER APPLY (SELECT SUM(y2.yl) AS 同物料同仓合计 FROM kucun y2
                  WHERE y2.wzdm=k.wzdm AND y2.ckdm=k.ckdm AND ISNULL(y2.asp_cancel,'N')<>'Y') sib
   WHERE ISNULL(k.asp_cancel,'N')<>'Y' AND ISNULL(k.yl,0) < -0.0001`)

console.log(`负结存行数:${rows.length}`)

const cat = { A_假负_同物料同仓合计为正: [], B1_真缺_本批出多于进: [], B2_真缺_纯出库批: [], B3_其它: [] }
for (const r of rows) {
  if (Number(r.同物料同仓合计) > 0.0001) cat.A_假负_同物料同仓合计为正.push(r)
  else if (Number(r.期初) === 0 && Number(r.入库) === 0) cat.B2_真缺_纯出库批.push(r)
  else if (Number(r.出库) > Number(r.期初) + Number(r.入库)) cat.B1_真缺_本批出多于进.push(r)
  else cat.B3_其它.push(r)
}
console.log('\n=== 归因分类 ===')
for (const [k, v] of Object.entries(cat)) {
  const s = v.reduce((a, b) => a + Number(b.结存), 0)
  console.log(`  ${k.padEnd(26)} ${String(v.length).padStart(4)} 行  合计 ${s.toFixed(2)}`)
}

console.log('\n=== A 类(假负)样例:同物料同仓合计为正 ===')
for (const r of cat.A_假负_同物料同仓合计为正.sort((a, b) => a.结存 - b.结存).slice(0, 6))
  console.log(`   ${r.wzdm.padEnd(16)} ${r.ckdm.padEnd(9)} 批=${String(r.lot || '(无)').padEnd(16)} 本批结存=${String(r.结存).padStart(9)}  同物料同仓合计=${String(r.同物料同仓合计).padStart(9)}`)

console.log('\n=== B2 类(纯出库批:无期初、无入库,只有出库)样例 ===')
for (const r of cat.B2_真缺_纯出库批.sort((a, b) => a.结存 - b.结存).slice(0, 8))
  console.log(`   ${r.wzdm.padEnd(16)} ${r.ckdm.padEnd(9)} 批=${String(r.lot || '(无)').padEnd(16)} 结存=${String(r.结存).padStart(9)} 出库=${String(r.出库).padStart(9)} 期初=${r.期初} 入库=${r.入库}`)

console.log('\n=== B1 类(本批出多于期初+入库)样例 ===')
for (const r of cat.B1_真缺_本批出多于进.sort((a, b) => a.结存 - b.结存).slice(0, 8))
  console.log(`   ${r.wzdm.padEnd(16)} ${r.ckdm.padEnd(9)} 批=${String(r.lot || '(无)').padEnd(16)} 结存=${String(r.结存).padStart(9)} 期初=${String(r.期初).padStart(9)} 入=${String(r.入库).padStart(9)} 出=${String(r.出库).padStart(9)}`)

console.log('\n=== 按物料汇总:缺口最大的 10 个 ===')
const byMat = new Map()
for (const r of rows) byMat.set(r.wzdm, (byMat.get(r.wzdm) || 0) + Number(r.结存))
for (const [w, v] of [...byMat.entries()].sort((a, b) => a[1] - b[1]).slice(0, 10))
  console.log(`   ${w.padEnd(20)} ${v.toFixed(2)}`)
await pool.close()
