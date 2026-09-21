import { createRequire } from 'node:module';
const mssql = createRequire('D:/jdy-sync/package.json')('mssql');
const pool = await new mssql.ConnectionPool({ server:'127.0.0.1', port:1433, database:'HSDZ_MES', user:'yinjia', password:'Yinjia@2026', options:{encrypt:false,trustServerCertificate:true} }).connect();
const q = async (s) => (await new mssql.Request(pool).query(s)).recordset;
console.log(JSON.stringify(await q("SELECT label, place FROM yj_field WHERE panel_code='INV' AND place LIKE N'%query%'")));
await pool.close();
