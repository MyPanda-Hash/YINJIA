/** 产成品入库:明细表里也有同物料同数量多行吗?(有=正常业务,无=流水重复) */
import mssql from '../../../deploy/node_modules/mssql/index.js'

const db = process.env.QDB || 'HSDZ_MES'
const pool = await mssql.connect({ server: '127.0.0.1', port: 1433, database: db, user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } })
const q = async (s) => (await pool.request().query(s)).recordset
const line = (t) => console.log('\n=== ' + t + ' ===')

line('CPRK 单据:头 / 明细 / 流水 三边对照(只列有重复流水的)')
const noList = (await q(`
  WITH d AS (SELECT 单据编号 FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y' AND 单据类型=N'产成品入库单'
              GROUP BY 单据编号, 物料编码, 仓库编码, 数量 HAVING COUNT(*)>1)
  SELECT DISTINCT 单据编号 FROM d ORDER BY 单据编号`)).map((x) => x.单据编号)
for (const no of noList) {
  const head = await q(`SELECT id FROM bd_finish_in WHERE 单据编号='${no}'`)
  const det = await q(`SELECT id, 产品编码, 仓库, 批号, CAST(实收数量 AS decimal(18,4)) q FROM bl_finish_in WHERE 单据编号='${no}' AND ISNULL(asp_cancel,'N')<>'Y' ORDER BY id`)
  const flow = await q(`SELECT id, rid, 物料编码, 仓库编码, 批号, CAST(数量 AS decimal(18,4)) q FROM inh WHERE 单据编号='${no}' AND ISNULL(asp_cancel,'N')<>'Y' ORDER BY id`)
  const detKey = det.map((x) => `${x.产品编码}|${x.q}`).sort().join(',')
  const flowKey = flow.map((x) => `${x.物料编码}|${x.q}`).sort().join(',')
  console.log(`   ${no}  头=${head.length} 明细=${det.length} 流水=${flow.length}  ${detKey === flowKey ? '✔ 一致(重复是正常多行)' : '✗ 不一致(流水多出)'}`)
  if (detKey !== flowKey) {
    console.log(`      明细: ${detKey}`)
    console.log(`      流水: ${flowKey}`)
  }
}

line('采购入库 CGRK 三边对照')
for (const no of ['CGRK-20260915-03213', 'CGRK-20260915-03214', 'CGRK-20260916-03215']) {
  const det = await q(`SELECT id, 存货编码, 仓库编码, CAST(实收数量 AS decimal(18,4)) q, 批号, 批次号 FROM bl_purchase_in WHERE 单据编号='${no}' AND ISNULL(asp_cancel,'N')<>'Y'`)
  const flow = await q(`SELECT id, rid, 物料编码, 仓库编码, CAST(数量 AS decimal(18,4)) q, 批号 FROM inh WHERE 单据编号='${no}' AND ISNULL(asp_cancel,'N')<>'Y' ORDER BY id`)
  console.log(`   ${no} 明细${det.length}行 / 流水${flow.length}行`)
  for (const d of det) console.log(`      明细 id=${d.id} ${d.存货编码} ${d.仓库编码} ${d.q} 批号=${d.批号 ?? 'null'} 批次号=${d.批次号 ?? 'null'}`)
  for (const f of flow) console.log(`      流水 id=${f.id} rid=${f.rid} ${f.物料编码} ${f.仓库编码} ${f.q} 批号=${f.批号 ?? 'null'}`)
}

await pool.close()
