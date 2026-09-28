import mssql from 'mssql';
const pool = await new mssql.ConnectionPool({server:'127.0.0.1',port:1433,database:'HSDZ_MES',user:'yinjia',password:'Yinjia@2026',options:{encrypt:false,trustServerCertificate:true}}).connect();
const q = async (s) => (await new mssql.Request(pool).query(s)).recordset;
console.log('=== v_stock_balance 列(找 仓库编码/存货编码)===');
console.log((await q("SELECT name FROM sys.columns WHERE object_id=OBJECT_ID('v_stock_balance') AND name IN (N'仓库编码',N'存货编码',N'仓库',N'存货')")).map(r=>r.name).join(', '));
console.log('\n=== 两视图 编码空值覆盖 ===');
for (const v of ['v_stock_ledger','v_stock_balance']) {
  const r = await q(`SELECT COUNT(*) total, SUM(CASE WHEN 仓库编码 IS NULL OR RTRIM(仓库编码)=N'' THEN 1 ELSE 0 END) whNull,
    SUM(CASE WHEN 存货编码 IS NULL OR RTRIM(存货编码)=N'' THEN 1 ELSE 0 END) invNull FROM ${v}`);
  console.log(`  ${v}: 共${r[0].total} 行, 仓库编码空=${r[0].whNull}, 存货编码空=${r[0].invNull}`);
}
console.log('\n=== 编码唯一性(仓库/存货,与名称对照)===');
const dup = await q(`SELECT 仓库编码, COUNT(DISTINCT RTRIM(仓库)) names FROM v_stock_ledger WHERE 仓库编码 IS NOT NULL GROUP BY 仓库编码 HAVING COUNT(DISTINCT RTRIM(仓库))>1`);
console.log(`  一码多名(仓库): ${dup.length} 组` + (dup.length? ' → '+dup.map(r=>`${r.仓库编码}(${r.names})`).join(','):''));
const dupi = await q(`SELECT 存货编码, COUNT(DISTINCT RTRIM(存货)) names FROM v_stock_ledger WHERE 存货编码 IS NOT NULL GROUP BY 存货编码 HAVING COUNT(DISTINCT RTRIM(存货))>1`);
console.log(`  一码多名(存货): ${dupi.length} 组`);
await pool.close();
