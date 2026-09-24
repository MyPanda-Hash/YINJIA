// _probe-missing-tbl-panel.cjs — 只读:52 张缺表级注明的表是否被 yj_panel 引用
const mssql = require('D:/workspace/yinjia/deploy/node_modules/mssql');
(async () => {
  const p = await new mssql.ConnectionPool({ server: 'localhost', port: 1433, database: 'HSDZ_MES', user: 'yinjia', password: 'Yinjia@2026', options: { encrypt: false } }).connect();
  const miss = (await p.request().query(`SELECT t.name FROM sys.tables t WHERE NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=t.object_id AND ep.minor_id=0 AND ep.name=N'MS_Description') ORDER BY t.name`)).recordset.map(r => r.name);
  const pan = (await p.request().query(`SELECT panel_code,panel_name,head_table,line_table,mode FROM yj_panel`)).recordset;
  const map = {};
  for (const r of pan) for (const t of [r.head_table, r.line_table]) if (t) (map[t] = map[t] || []).push(`${r.panel_code}[${r.mode}]`);
  let used = 0; const unused = [];
  for (const t of miss) { if (map[t]) { used++; console.log('USED   ' + t + '  <-  ' + map[t].join(', ')); } else unused.push(t); }
  console.log('---');
  console.log('有面板引用: ' + used + ' / 无面板引用: ' + unused.length);
  console.log('无引用清单: ' + unused.join(', '));
  await p.close();
})().catch(e => { console.error(e); process.exit(1); });
