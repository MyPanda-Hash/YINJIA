/**
 * _q-perm-words-cols.mjs —— 迁移前取证(只读):yj_role_panel 结构 + 待规范化行的精确清单 + 词全集
 * 用法: node tools/archive/_rd-perm-audit-20261016/_q-perm-words-cols.mjs [--db HSDZ_MES]
 */
import mssql from '../../../deploy/node_modules/mssql/index.js'

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i >= 0 ? process.argv[i + 1] : d }
const DB = arg('db', 'HSDZ_MES')
const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: DB, user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true },
})
const q = async (s) => (await pool.request().query(s)).recordset
const out = []
const say = (s = '') => { out.push(s); console.log(s) }

say(`## ${DB} · yj_role_panel 结构`)
for (const c of await q(`SELECT c.name, t.name AS ty, c.max_length, c.is_nullable,
    ISNULL(CONVERT(nvarchar(200), ep.value), '') AS 注明
  FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
  LEFT JOIN sys.extended_properties ep ON ep.major_id = c.object_id AND ep.minor_id = c.column_id AND ep.name = 'MS_Description'
  WHERE c.object_id = OBJECT_ID('yj_role_panel') ORDER BY c.column_id`))
  say(`- ${c.name} ${c.ty}(${c.max_length}) null=${c.is_nullable} ${c.注明}`)

say(`\n## 全表约束/索引`)
for (const c of await q(`SELECT i.name, i.is_unique, i.is_primary_key,
    STUFF((SELECT ',' + col.name FROM sys.index_columns ic JOIN sys.columns col ON col.object_id=ic.object_id AND col.column_id=ic.column_id
           WHERE ic.object_id=i.object_id AND ic.index_id=i.index_id ORDER BY ic.key_ordinal FOR XML PATH('')),1,1,'') AS cols
  FROM sys.indexes i WHERE i.object_id = OBJECT_ID('yj_role_panel')`))
  say(`- ${c.name} unique=${c.is_unique} pk=${c.is_primary_key} (${c.cols})`)

say(`\n## 含 legacy 词(edit/delete/price/review/adjust)的行 —— 迁移目标`)
const rows = await q(`SELECT role_id, panel_code, ISNULL(perms,'') AS perms, ISNULL(can_approve,'N') AS ca
  FROM yj_role_panel
  WHERE ','+ISNULL(perms,'')+',' LIKE '%,edit,%' OR ','+ISNULL(perms,'')+',' LIKE '%,delete,%'
     OR ','+ISNULL(perms,'')+',' LIKE '%,price,%' OR ','+ISNULL(perms,'')+',' LIKE '%,review,%'
     OR ','+ISNULL(perms,'')+',' LIKE '%,adjust,%'
  ORDER BY panel_code, role_id`)
for (const r of rows) say(`${r.panel_code}\trole${r.role_id}\t${r.perms}\tca=${r.ca}`)
say(`行数=${rows.length}`)

say(`\n## 全库词全集`)
const all = await q(`SELECT DISTINCT LTRIM(RTRIM(v)) AS w FROM yj_role_panel rp
  CROSS APPLY (SELECT CAST('<i>'+REPLACE(ISNULL(rp.perms,''),',','</i><i>')+'</i>' AS XML) AS x) t
  CROSS APPLY (SELECT T.c.value('.','nvarchar(50)') AS v FROM t.x.nodes('/i') AS T(c)) z WHERE LTRIM(RTRIM(v))<>''`)
say(all.map((x) => x.w).sort().join(', '))

say(`\n## total rows=${(await q('SELECT COUNT(*) AS n FROM yj_role_panel'))[0].n}`)
await pool.close()
