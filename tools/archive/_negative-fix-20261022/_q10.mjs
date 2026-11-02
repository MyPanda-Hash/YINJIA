/** 只读探针 ⑩:建表 DDL(自增 / 默认值 / 约束),确保直插与 UI 保存同源 */
import mssql from '../../../deploy/node_modules/mssql/index.js'

const db = process.env.QDB || 'HSDZ_MES'
const pool = await mssql.connect({ server: '127.0.0.1', port: 1433, database: db, user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } })
const q = async (s) => (await pool.request().query(s)).recordset
const line = (t) => console.log('\n=== ' + t + ' ===')

for (const t of ['bd_other_in', 'bl_other_in', 'yj_doc_status', 'yj_form_approval', 'inh', 'kucun']) {
  line(t + ' 标识列/默认值/约束')
  for (const r of await q(`SELECT c.name AS col, c.is_identity AS isid, OBJECT_DEFINITION(c.default_object_id) AS dflt
                             FROM sys.columns c WHERE c.object_id = OBJECT_ID('${t}') AND (c.is_identity=1 OR c.default_object_id<>0)`))
    console.log(`   ${String(r.col).padEnd(16)} identity=${r.isid} default=${r.dflt ?? '-'}`)
  for (const r of await q(`SELECT i.name AS ix, i.is_unique AS uq, i.is_primary_key AS pk,
                                  STUFF((SELECT ',' + c2.name FROM sys.index_columns ic2 JOIN sys.columns c2
                                          ON c2.object_id=ic2.object_id AND c2.column_id=ic2.column_id
                                          WHERE ic2.object_id=i.object_id AND ic2.index_id=i.index_id AND ic2.is_included_column=0
                                          ORDER BY ic2.key_ordinal FOR XML PATH('')), 1, 1, '') AS cols
                             FROM sys.indexes i WHERE i.object_id = OBJECT_ID('${t}') AND i.name IS NOT NULL`))
    console.log(`   索引 ${String(r.ix).padEnd(34)} pk=${r.pk} uq=${r.uq} (${r.cols})`)
  for (const r of await q(`SELECT cc.name AS ck, OBJECT_DEFINITION(cc.object_id) AS def FROM sys.check_constraints cc
                            WHERE cc.parent_object_id = OBJECT_ID('${t}')`))
    console.log(`   检查 ${r.ck}: ${String(r.def).slice(0, 120)}`)
  for (const r of await q(`SELECT tr.name FROM sys.triggers tr WHERE tr.parent_id = OBJECT_ID('${t}') AND tr.is_disabled = 0`))
    console.log(`   触发器 ${r.name}`)
}

await pool.close()
