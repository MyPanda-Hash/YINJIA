// _probe-legacy-rowcount.cjs — 只读:52 张缺注明表的行数(判断旧表是否仍有数据)
const mssql = require('D:/workspace/yinjia/deploy/node_modules/mssql');
(async () => {
  const p = await new mssql.ConnectionPool({ server: 'localhost', port: 1433, database: 'HSDZ_MES', user: 'yinjia', password: 'Yinjia@2026', options: { encrypt: false } }).connect();
  const sys = new Set(['dtproperties']);
  const infra = new Set(['yj_panel','yj_field','yj_doc_status','yj_translation','yj_user','yj_role','yj_role_panel','yj_locale','yj_dept','yj_form_approval','yj_usage_log','yj_schema_log','yj_message','yj_attachment','yj_lot_seq','yj_std_lib','yj_plan_term','yj_doc_modify_log','form_flow_link','report_column_settings','qr_batch_registry','rd_dev_task','rd_spec_assign']);
  const miss = (await p.request().query(`SELECT t.name FROM sys.tables t WHERE NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=t.object_id AND ep.minor_id=0 AND ep.name=N'MS_Description') ORDER BY t.name`)).recordset.map(r => r.name);
  for (const t of miss) {
    if (sys.has(t)) { console.log(t + '  [系统残留]'); continue; }
    if (infra.has(t)) { continue; }
    let n = 0;
    try { n = (await p.request().query(`SELECT COUNT(*) n FROM [${t}]`)).recordset[0].n; } catch (e) { console.log(t + '  [count失败] ' + e.message.slice(0, 60)); continue; }
    console.log(t.padEnd(24) + ' rows=' + n);
  }
  await p.close();
})().catch(e => { console.error(e); process.exit(1); });
