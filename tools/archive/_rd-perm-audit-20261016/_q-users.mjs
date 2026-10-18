import mssql from '../../../deploy/node_modules/mssql/index.js'
const p = await mssql.connect({ server:'127.0.0.1', port:1433, database:'HSDZ_MES', user:'yinjia', password: process.env.YINJIA_SQL_PASS||'Yinjia@2026', options:{encrypt:false,trustServerCertificate:true} })
const cols = await p.request().query("SELECT c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('yj_user') ORDER BY c.column_id")
console.log('列:', cols.recordset.map(x=>x.name).join(','))
const r = await p.request().query("SELECT u.username, u.real_name, u.role_id, r.role_code, r.role_name, ISNULL(u.is_admin,'N') ia, u.enabled FROM yj_user u LEFT JOIN yj_role r ON r.id=u.role_id ORDER BY u.username")
for (const x of r.recordset) console.log(`${x.username}\t${x.real_name}\trole${x.role_id}/${x.role_code}\tadmin=${x.ia}\tenabled=${x.enabled}`)
await p.close()
