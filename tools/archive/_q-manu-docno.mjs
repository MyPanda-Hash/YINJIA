// 一次性探针:MANU_ORDER/WO_ORDER/KHDD 列表与 ?docNo= 过滤为何取不到单据
import { createRequire } from 'node:module';
const mssql = createRequire('D:/jdy-sync/package.json')('mssql');
const API = 'http://localhost:8090/api';
const pool = await new mssql.ConnectionPool({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia', password: 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } }).connect();
const q = async (s) => (await new mssql.Request(pool).query(s)).recordset;

const lj = await (await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json();
const H = { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + lj.data.token };
const list = async (pc, condition = {}) => {
  const r = await fetch(API + '/px/queryFormDataList', { method: 'POST', headers: H, body: JSON.stringify({ panelCode: pc, condition, pageNo: 1, pageSize: 5 }) });
  const j = await r.json();
  return j.data || j;
};

for (const pc of ['MANU_ORDER', 'WO_ORDER', 'KHDD']) {
  const p = (await q(`SELECT panel_code, panel_name, head_table, line_table, group_col FROM yj_panel WHERE panel_code=N'${pc}'`))[0];
  const cols = (await q(`SELECT COLUMN_NAME c FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='${p.head_table}'`)).map(r => r.c);
  const hasSt = cols.includes('单据状态');
  const rows = await q(`SELECT TOP 3 [${p.group_col}] no ${hasSt ? ', 单据状态 st' : ''} FROM ${p.head_table} WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY asp_time1 DESC`).catch(() => []);
  console.log(`\n${pc} ${p.panel_name} head=${p.head_table} group=${p.group_col} 有单据状态列=${hasSt}`);
  console.log('  表内前 3 单:', JSON.stringify(rows));
  const all = await list(pc);
  console.log(`  API 全量: totalSize=${all.totalSize} 首单=${JSON.stringify((all.list || [])[0]?.编号)}`);
  if (rows[0]) {
    const f = await list(pc, { _docNo: rows[0].no });
    console.log(`  API _docNo=${rows[0].no}: totalSize=${f.totalSize} 单号=${JSON.stringify((f.list || []).map(d => d.编号))}`);
  }
  const att = await q(`SELECT col_name, data_type, place, hidden FROM yj_field WHERE panel_code=N'${pc}' AND data_type=N'附件'`);
  console.log('  附件字段:', JSON.stringify(att));
}
await pool.close();
