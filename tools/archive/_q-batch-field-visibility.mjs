// 一次性探针:四张单「批次号」字段的元数据 + 运行时配置(界面到底会不会渲染表头/明细列)
import { createRequire } from 'node:module';
const mssql = createRequire('D:/jdy-sync/package.json')('mssql');
const API = process.env.YJ_API || 'http://localhost:8090/api';
const pool = await new mssql.ConnectionPool({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia', password: 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } }).connect();
const q = async (s) => (await new mssql.Request(pool).query(s)).recordset;

console.log('=== yj_field 里 批次号 的定义 ===');
for (const r of await q("SELECT panel_code, label, col_name, place, seq, hidden, visible, editable FROM yj_field WHERE col_name=N'批次号' AND panel_code IN ('SL_RECV','QC_INSP','QC_RETURN','PURCHASE_IN') ORDER BY panel_code, seq")) {
  console.log('  ', JSON.stringify(r));
}
const lj = await (await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json();
const H = { Authorization: 'Bearer ' + lj.data.token };
console.log('\n=== 运行时配置(前端真正拿到的字段) ===');
for (const pc of ['SL_RECV', 'QC_INSP', 'QC_RETURN', 'PURCHASE_IN']) {
  const cfg = (await (await fetch(`${API}/px/getPanelConfig?panelCode=${pc}`, { headers: H })).json()).data || {};
  const names = cfg?.metadata?.panelPageDto?.formPages?.[0]?.fieldNames || '';
  const heads = (cfg?.dataSchema?.fields || []).filter((f) => !f.hidden).map((f) => f.dataName || f.label);
  const det = (cfg?.detail?.tabs?.[0]?.fields || []).map((f) => f.dataName || f.label);
  console.log(`  ${pc}: fieldNames=${JSON.stringify(String(names).slice(0, 60))}`);
  console.log(`     表头含批次号=${heads.includes('批次号')}  (表头字段数 ${heads.length})`);
  console.log(`     明细含批次号=${det.includes('批次号')}  (明细字段数 ${det.length})`);
  if (!heads.includes('批次号')) console.log(`     表头字段: ${JSON.stringify(heads.slice(0, 30))}`);
}
await pool.close();
