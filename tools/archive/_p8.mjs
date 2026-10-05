import mssql from 'mssql';
const pool = await new mssql.ConnectionPool({server:'127.0.0.1',port:1433,database:'HSDZ_MES',user:'yinjia',password:'Yinjia@2026',options:{encrypt:false,trustServerCertificate:true}}).connect();
const q = async (s) => (await new mssql.Request(pool).query(s)).recordset;
console.log('=== INV 面板模式 ===');
for (const r of await q("SELECT panel_code, mode, line_table FROM yj_panel WHERE panel_code='INV'")) console.log(`  INV: mode=${r.mode}, line=${r.line_table}`);
const total = (await q('SELECT COUNT(*) n FROM bs_inv'))[0].n;
console.log(`bs_inv 总行数: ${total}(queryArchive 上限 2000 / queryRefRows pageSize 200)`);
console.log('\n=== 各仓收窄后的存货,在档案里的 id 降序排名(>2000=弹窗永远看不到)===');
const whs = await q("SELECT DISTINCT RTRIM(仓库) AS wh FROM v_stock_ledger WHERE 仓库 IS NOT NULL AND RTRIM(仓库)<>'' AND 仓库 NOT LIKE N'(未填%'");
for (const { wh } of whs) {
  const items = await q(`SELECT DISTINCT RTRIM(存货) AS item FROM v_stock_ledger WHERE RTRIM(仓库)=N'${wh.replace(/'/g,"''")}'
    AND EXISTS (SELECT 1 FROM bs_inv i WHERE RTRIM(i.存货名称)=RTRIM(存货) AND ISNULL(i.asp_cancel,'N')<>'Y')`);
  const bad = [];
  for (const { item } of items) {
    const r = await q(`SELECT COUNT(*) n FROM bs_inv WHERE id > (SELECT MIN(id) FROM bs_inv WHERE RTRIM(存货名称)=N'${item.replace(/'/g,"''")}')`);
    if (r[0].n >= 2000) bad.push(item);
  }
  if (bad.length) console.log(`【${wh}】${items.length} 项中 ${bad.length} 项超 2000 行窗口被弹窗丢弃: ${bad.join(' | ')}`);
}
console.log('(未列出的仓库 = 收窄项都在前 2000 行内)');
await pool.close();
