import mssql from 'mssql';
const pool = await new mssql.ConnectionPool({server:'127.0.0.1',port:1433,database:'HSDZ_MES',user:'yinjia',password:'Yinjia@2026',options:{encrypt:false,trustServerCertificate:true}}).connect();
const q = async (s) => (await new mssql.Request(pool).query(s)).recordset;
const v = await q("SELECT m.definition FROM sys.sql_modules m JOIN sys.objects o ON o.object_id=m.object_id WHERE o.name='v_stock_movement'");
console.log('=== v_stock_movement 定义(前 60 行)===');
console.log(v[0].definition.split('\n').slice(0,60).join('\n'));
console.log('...');
console.log('=== 视图里 仓库/仓库编码 组合分布 ===');
for (const r of await q("SELECT 仓库编码, 仓库, COUNT(*) n FROM v_stock_ledger GROUP BY 仓库编码, 仓库 ORDER BY n DESC"))
  console.log(`  ckdm=${String(r.仓库编码).padEnd(8)} 仓库=${String(r.仓库).padEnd(12)} 行数=${r.n}`);
console.log('=== bs_wh 档案 ===');
for (const r of await q("SELECT 仓库编码, 仓库名称, [状态] FROM bs_wh ORDER BY 仓库编码"))
  console.log(`  ${String(r.仓库编码).padEnd(8)} ${String(r.仓库名称).padEnd(12)} ${r[状态]}`);
await pool.close();
