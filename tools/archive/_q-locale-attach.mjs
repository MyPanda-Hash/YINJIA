import { createRequire } from 'node:module';
const mssql = createRequire('D:/jdy-sync/package.json')('mssql');
const pool = await new mssql.ConnectionPool({ server:'127.0.0.1', port:1433, database:'HSDZ_MES', user:'yinjia', password:'Yinjia@2026', options:{encrypt:false,trustServerCertificate:true} }).connect();
const q = async (s) => (await new mssql.Request(pool).query(s)).recordset;
console.log('yj_locale:', JSON.stringify(await q('SELECT * FROM yj_locale')));
console.log('\n附件 词条(任意 scope):', JSON.stringify(await q("SELECT scope, ref_key, locale, text FROM yj_translation WHERE ref_key LIKE N'附件%' ORDER BY ref_key, locale")));
console.log('\n「附件」词条:', JSON.stringify(await q("SELECT locale, text FROM yj_translation WHERE ref_key=N'附件' ORDER BY locale")));
await pool.close();
