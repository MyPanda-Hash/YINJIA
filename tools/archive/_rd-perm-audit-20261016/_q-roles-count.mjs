import mssql from '../../../deploy/node_modules/mssql/index.js'
const p = await mssql.connect({ server:'127.0.0.1', port:1433, database:'HSDZ_MES', user:'yinjia', password: process.env.YINJIA_SQL_PASS||'Yinjia@2026', options:{encrypt:false,trustServerCertificate:true} })
console.log('roles:', (await p.request().query('SELECT id, role_code FROM yj_role ORDER BY id')).recordset.map(r=>r.id+':'+r.role_code).join(' '))
console.log('yj_panel 总行数:', (await p.request().query('SELECT COUNT(*) n FROM yj_panel')).recordset[0].n)
console.log('STOCK_DETAIL:', JSON.stringify((await p.request().query("SELECT panel_code, panel_name, category, module_group, detail_key FROM yj_panel WHERE panel_code=N'STOCK_DETAIL'")).recordset))
await p.close()
