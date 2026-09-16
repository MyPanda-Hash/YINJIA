import mssql from 'mssql';
const pool = await new mssql.ConnectionPool({server:'127.0.0.1',port:1433,database:'HSDZ_MES',user:'yinjia',password:'Yinjia@2026',options:{encrypt:false,trustServerCertificate:true}}).connect();
const q = async (s) => (await new mssql.Request(pool).query(s)).recordset[0].n;
console.log('=== 行数 ===');
for (const t of ['bd_so_order','bl_so_order','bd_pu_order','bl_pu_order']) console.log(`${t}: ${await q(`SELECT COUNT(*) n FROM ${t}`)}`);
console.log('同步标记(外部数据ID 非空):');
for (const t of ['bd_so_order','bd_pu_order']) console.log(`  ${t}: ${await q(`SELECT COUNT(*) n FROM ${t} WHERE 外部数据ID IS NOT NULL`)}`);
console.log('=== 单据状态分布 ===');
for (const t of ['bd_so_order','bd_pu_order']) {
  const rs = (await new mssql.Request(pool).query(`SELECT 单据状态, COUNT(*) n FROM ${t} GROUP BY 单据状态`)).recordset;
  console.log(`  ${t}: ` + rs.map(r=>`${r.单据状态}=${r.n}`).join(', '));
}
console.log('=== yj_doc_status 镜像 ===');
for (const p of ['SO_ORDER','PU_ORDER']) {
  const rs = (await new mssql.Request(pool).query(`SELECT COUNT(*) tot, SUM(CASE WHEN shr IS NOT NULL THEN 1 ELSE 0 END) audited, SUM(CASE WHEN stopped=N'Y' THEN 1 ELSE 0 END) stopped FROM yj_doc_status WHERE panel_code=N'${p}'`)).recordset[0];
  console.log(`  ${p}: 共${rs.tot}, 已审核${rs.audited}, 中止${rs.stopped}`);
}
console.log('=== 抽样(最新3张销售订单) ===');
for (const r of (await new mssql.Request(pool).query("SELECT TOP 3 单据编号,客户,业务员,单据日期,单据状态,审核人,外部数据ID FROM bd_so_order ORDER BY asp_time1 DESC")).recordset)
  console.log(`  ${r.单据编号} | ${r.客户} | ${r.业务员} | ${r.单据日期?.toISOString?.().slice(0,10)} | ${r.单据状态} | 审核人=${r.审核人}`);
console.log('=== 抽样(最新3张采购订单) ===');
for (const r of (await new mssql.Request(pool).query("SELECT TOP 3 单据编号,供应商,币种,单据日期,单据状态,审核人 FROM bd_pu_order ORDER BY asp_time1 DESC")).recordset)
  console.log(`  ${r.单据编号} | ${r.供应商} | ${r.币种} | ${r.单据日期?.toISOString?.().slice(0,10)} | ${r.单据状态} | 审核人=${r.审核人}`);
console.log('=== 数据完整性:头表无行表的单据数 ===');
console.log('  SO:', await q("SELECT COUNT(*) n FROM bd_so_order h WHERE NOT EXISTS (SELECT 1 FROM bl_so_order l WHERE l.单据编号=h.单据编号)"));
console.log('  PU:', await q("SELECT COUNT(*) n FROM bd_pu_order h WHERE NOT EXISTS (SELECT 1 FROM bl_pu_order l WHERE l.单据编号=h.单据编号)"));
await pool.close();
