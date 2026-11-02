/** 清理测试账套里本次验证造成的单据 */
import mssql from '../../../deploy/node_modules/mssql/index.js'
const pool = await mssql.connect({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES_TEST', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } })
const run = (s) => pool.request().query(s)
const q = async (s) => (await run(s)).recordset

const INSP = 'IJ-2026-10-TEST01'
// 本次链上生成的所有单据
const nos = new Set([INSP])
for (const r of await q(`SELECT target_form_no no FROM form_flow_link WHERE source_form_no='${INSP}'
                          OR source_form_no IN (SELECT target_form_no FROM form_flow_link WHERE source_form_no='${INSP}')`)) nos.add(r.no)
// 特采链再往下
for (const n of [...nos]) {
  for (const r of await q(`SELECT target_form_no no FROM form_flow_link WHERE source_form_no='${n}'`)) nos.add(r.no)
}
console.log('待清理单据:', [...nos].join(', '))

for (const no of nos) {
  await run(`DELETE FROM form_flow_link WHERE source_form_no='${no}' OR target_form_no='${no}'`)
  await run(`DELETE FROM yj_doc_status WHERE doc_no='${no}'`)
  await run(`DELETE FROM yj_form_approval WHERE form_no='${no}'`)
  await run(`DELETE FROM inh WHERE 单据编号='${no}'`)
  for (const t of ['bd_purchase_in', 'bl_purchase_in', 'qc_insp', 'qc_insp_detail', 'qc_return', 'qc_return_detail', 'qc_tc_in']) {
    await run(`DELETE FROM ${t} WHERE 单据编号='${no}'`)
  }
}
// 清理本次库存在 kucun 里留下的行(YJ-SS-003 若由本次造出)
await run(`DELETE FROM kucun WHERE wzdm='YJ-SS-003' AND ISNULL(asp_user1,'') LIKE 'stock:%'`)

const left = await q(`SELECT
  (SELECT COUNT(*) FROM form_flow_link WHERE source_form_no='${INSP}' OR target_form_no='${INSP}') link,
  (SELECT COUNT(*) FROM bl_purchase_in WHERE 单据编号 IN (SELECT target_form_no FROM form_flow_link WHERE 1=0)) x`)
console.log('残留链路:', JSON.stringify(left[0]))
console.log('清理后单据是否存在:', JSON.stringify(await q(`SELECT
  (SELECT COUNT(*) FROM qc_insp WHERE 单据编号='${INSP}') insp,
  (SELECT COUNT(*) FROM qc_insp_detail WHERE 单据编号='${INSP}') det`)))
await pool.close()
