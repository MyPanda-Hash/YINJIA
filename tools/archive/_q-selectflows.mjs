// 一次性探针:列出所有面板的 selectConfig(选单来源/列/映射)与 selectConfigs(多来源)
import { createRequire } from 'node:module';
const require = createRequire('D:/YINJIA-main/deploy/package.json');
const mssql = require('mssql');
const API = 'http://localhost:8090/api';

const lr = await fetch(API + '/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
});
const token = (await lr.json())?.data?.token;
if (!token) { console.error('登录失败'); process.exit(1); }

const pool = new mssql.ConnectionPool({
  server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia', password: 'Yinjia@2026',
  options: { encrypt: false, trustServerCertificate: true },
});
await pool.connect();
const panels = (await new mssql.Request(pool).query(
  `SELECT panel_code, panel_name, mode, category FROM yj_panel WHERE mode = 'doc' ORDER BY panel_code`)).recordset;
await pool.close();

const rows = [];
for (const p of panels) {
  try {
    const j = await (await fetch(`${API}/px/getPanelConfig?panelCode=${encodeURIComponent(p.panel_code)}`, { headers: { Authorization: 'Bearer ' + token } })).json();
    const cfg = j?.data || j;
    if (!cfg) continue;
    const sc = cfg.selectConfig;
    const scs = cfg.selectConfigs;
    if ((sc && Object.keys(sc).length) || (scs && Object.keys(scs).length)) {
      const desc = [];
      if (sc && Object.keys(sc).length) desc.push(`selectConfig←${sc.source || '?'}(列${(sc.columns || []).length}/头映射${(sc.headerMap || []).length}/行映射${(sc.detailMap || []).length})`);
      if (scs) for (const [k, v] of Object.entries(scs)) desc.push(`selectConfigs[${k}]←${v?.source || '?'}`);
      rows.push(`${p.panel_code.padEnd(24)} ${String(p.panel_name).padEnd(16)} ${p.mode.padEnd(8)} ${desc.join(' | ')}`);
    }
  } catch (e) { rows.push(`${p.panel_code} 查询失败: ${e.message}`); }
}
console.log(`=== 有选单配置的面板(${rows.length} 个)===`);
for (const r of rows) console.log('  ' + r);
