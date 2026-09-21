const mssql = require('D:/workspace/yinjia/deploy/node_modules/mssql');
(async () => {
  const p = await new mssql.ConnectionPool({ server: 'localhost', port: 1433, database: 'HSDZ_MES', user: 'yinjia', password: 'Yinjia@2026', options: { encrypt: false } }).connect();
  const r = (await p.request().query(`SELECT panel_code, panel_name, head_table, line_table FROM yj_panel WHERE head_table LIKE '%gran%' OR line_table LIKE '%gran%' OR panel_name LIKE N'%造粒%' OR panel_name LIKE N'%封箱%' OR panel_name LIKE N'%无黑%' OR panel_name LIKE N'%退货%'`)).recordset;
  console.log(JSON.stringify(r, null, 1)); await p.close();
})().catch(e => { console.error(e.message); process.exit(1); });
