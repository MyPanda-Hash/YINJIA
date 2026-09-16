import mssql from 'mssql';
const pool = await new mssql.ConnectionPool({server:'127.0.0.1',port:1433,database:'HSDZ_MES',user:'yinjia',password:'Yinjia@2026',options:{encrypt:false,trustServerCertificate:true}}).connect();
const q = async (s) => (await new mssql.Request(pool).query(s)).recordset[0].n;
console.log('bd_so_order:', await q('SELECT COUNT(*) n FROM bd_so_order'), '| bl_so_order:', await q('SELECT COUNT(*) n FROM bl_so_order'));
console.log('bd_pu_order:', await q('SELECT COUNT(*) n FROM bd_pu_order'), '| bl_pu_order:', await q('SELECT COUNT(*) n FROM bl_pu_order'));
await pool.close();
