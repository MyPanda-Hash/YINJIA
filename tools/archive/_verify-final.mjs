import mssql from 'mssql';
const pool = await new mssql.ConnectionPool({server:'127.0.0.1',port:1433,database:'HSDZ_MES',user:'yinjia',password:'Yinjia@2026',options:{encrypt:false,trustServerCertificate:true}}).connect();
const q = async (s) => (await new mssql.Request(pool).query(s)).recordset;
console.log('=== 外部指纹写入 ===');
for (const t of ['bd_so_order','bd_pu_order'])
  console.log(`  ${t}: ${(await q(`SELECT COUNT(*) n FROM ${t} WHERE 外部指纹 IS NOT NULL`))[0].n}`);
console.log('=== 异常检查 ===');
console.log('  非已审核单据:', (await q("SELECT COUNT(*) n FROM bd_so_order WHERE 单据状态<>N'已审核'"))[0].n + (await q("SELECT COUNT(*) n FROM bd_pu_order WHERE 单据状态<>N'已审核'"))[0].n);
console.log('  已取消标记:', (await q("SELECT COUNT(*) n FROM bd_so_order WHERE asp_cancel=N'Y'"))[0].n + (await q("SELECT COUNT(*) n FROM bd_pu_order WHERE asp_cancel=N'Y'"))[0].n);
console.log('  写入留痕非 jdy-sync:', (await q("SELECT COUNT(*) n FROM bd_so_order WHERE asp_user1<>N'jdy-sync'"))[0].n + (await q("SELECT COUNT(*) n FROM bd_pu_order WHERE asp_user1<>N'jdy-sync'"))[0].n);
console.log('  外部数据ID 重复:', (await q("SELECT COUNT(*) n FROM (SELECT 外部数据ID FROM bd_so_order GROUP BY 外部数据ID HAVING COUNT(*)>1) x"))[0].n + (await q("SELECT COUNT(*) n FROM (SELECT 外部数据ID FROM bd_pu_order GROUP BY 外部数据ID HAVING COUNT(*)>1) x"))[0].n);
console.log('=== 关键字段空值率(销售订单) ===');
for (const c of ['客户','业务员','单据日期','审核人','审核时间'])
  console.log(`  ${c}: 空 ${(await q(`SELECT COUNT(*) n FROM bd_so_order WHERE [${c}] IS NULL OR [${c}]=N''`))[0].n} / 3789`);
console.log('=== 行表关键字段(销售订单行) ===');
for (const c of ['存货名称','数量','单价','金额'])
  console.log(`  ${c}: 空 ${(await q(`SELECT COUNT(*) n FROM bl_so_order WHERE [${c}] IS NULL`))[0].n} / 6031`);
await pool.close();
