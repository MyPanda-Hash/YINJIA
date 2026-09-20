// 一次性探针:调后端 /px/getPanelConfig,对比采购订单 vs 销售订单的明细页签(明细/汇总)结构
import { createRequire } from 'node:module';
const require = createRequire('D:/YINJIA-main/deploy/package.json');
const mssql = require('mssql');
const API = 'http://localhost:8090/api';

const login = await fetch(API + '/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
});
const lj = await login.json();
const token = lj?.data?.token;
if (!token) { console.error('登录失败', JSON.stringify(lj).slice(0, 300)); process.exit(1); }

// yj_field 列(找汇总相关标记列)
const pool = new mssql.ConnectionPool({
  server: '127.0.0.1', port: 1433, database: 'HSDZ_MES',
  user: 'yinjia', password: 'Yinjia@2026',
  options: { encrypt: false, trustServerCertificate: true },
});
await pool.connect();
const cols = (await new mssql.Request(pool).query(
  `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='yj_field' ORDER BY ORDINAL_POSITION`)).recordset;
console.log('=== yj_field 列 ===');
console.log(cols.map((c) => c.COLUMN_NAME).join(', '));

for (const pc of ['PU_ORDER', 'SO_ORDER', 'PU_REQ', 'SALES_ORDER_STATS']) {
  const res = await fetch(`${API}/px/getPanelConfig?panelCode=${pc}`, { headers: { Authorization: 'Bearer ' + token } });
  const j = await res.json();
  const cfg = j?.data || j;
  console.log(`\n=== ${pc} (HTTP ${res.status}) ===`);
  if (!cfg || !cfg.detail) { console.log('无 detail:', JSON.stringify(j).slice(0, 300)); continue; }
  console.log('detailKey:', cfg.detailKey, '| tabs:', (cfg.detail.tabs || []).length);
  for (const t of cfg.detail.tabs || []) {
    const fields = t.fields || [];
    console.log(`  页签[${t.key}] label="${t.label}" 字段=${fields.length} summaryItems=${JSON.stringify(t.summaryItems || [])}`);
    if (t.summaryItems?.length) {
      for (const s of t.summaryItems) console.log(`      汇总项: ${JSON.stringify(s)}`);
    }
  }
  console.log('  头字段数:', (cfg.dataSchema?.fields || []).length);
}

console.log('\n=== yj_field 中带汇总/合计标记的行(PU_ORDER/SO_ORDER) ===');
const fr = (await new mssql.Request(pool).query(
  `SELECT * FROM yj_field WHERE panel_code IN ('PU_ORDER','SO_ORDER') ORDER BY panel_code, id`)).recordset;
const sample = fr[0] || {};
console.log('列名:', Object.keys(sample).join(', '));
for (const r of fr) {
  const hit = Object.entries(r).some(([k, v]) => /汇总|合计|sum/i.test(String(v)) || /sum/i.test(k));
  if (hit) console.log(JSON.stringify(r).slice(0, 400));
}

await pool.close();
