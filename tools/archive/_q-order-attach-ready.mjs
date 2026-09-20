// 一次性探针:订单类面板的表单字段来源(有无 fieldNames 白名单)+ 附件字段现状 + 翻译词条
import { createRequire } from 'node:module';
const mssql = createRequire('D:/jdy-sync/package.json')('mssql');
const API = process.env.YJ_API || 'http://localhost:8090/api';
const pool = await new mssql.ConnectionPool({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia', password: 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } }).connect();
const q = async (sql) => (await new mssql.Request(pool).query(sql)).recordset;

const PANELS = ['PU_ORDER', 'SO_ORDER', 'MANU_ORDER', 'OUTSOURCE_ORDER', 'WO_ORDER', 'KHDD', 'CGD'];
console.log('=== 面板基础信息 ===');
for (const pc of PANELS) {
  const p = (await q(`SELECT panel_code, panel_name, mode, head_table, line_table, group_col FROM yj_panel WHERE panel_code=N'${pc}'`))[0];
  const att = (await q(`SELECT COUNT(*) n FROM yj_field WHERE panel_code=N'${pc}' AND data_type=N'附件'`))[0].n;
  console.log(`  ${pc.padEnd(16)} ${String(p.panel_name).padEnd(10)} ${String(p.mode).padEnd(5)} head=${String(p.head_table || '-').padEnd(18)} line=${String(p.line_table || '-').padEnd(18)} group=${p.group_col} 附件字段=${att}`);
}

console.log('\n=== 表单字段白名单(formPages[0].fieldNames)===');
const lj = await (await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json();
const H = { Authorization: 'Bearer ' + lj.data.token };
for (const pc of PANELS) {
  const r = await (await fetch(`${API}/px/getPanelConfig?panelCode=${pc}`, { headers: H })).json();
  const cfg = r?.data || {};
  const names = cfg?.metadata?.panelPageDto?.formPages?.[0]?.fieldNames || '';
  const fields = (cfg?.dataSchema?.fields || []).filter((f) => !f.hidden).map((f) => f.dataName || f.label);
  console.log(`  ${pc.padEnd(16)} fieldNames=${JSON.stringify(String(names).slice(0, 80))} 非隐藏字段 ${fields.length} 个 | 含附件字段: ${fields.filter((f) => /^附件/.test(f)).join(',') || '无'}`);
}

console.log('\n=== 翻译词条 附件1..附件6 ===');
const tr = await q("SELECT ref_key, COUNT(*) n FROM yj_translation WHERE scope='field' AND ref_key IN (N'附件1',N'附件2',N'附件3',N'附件4',N'附件5',N'附件6') GROUP BY ref_key ORDER BY ref_key");
console.log('  每个词条已有语言数:', JSON.stringify(tr.map(r => `${r.ref_key}:${r.n}`)));
console.log('  已有语言:', JSON.stringify((await q("SELECT DISTINCT locale FROM yj_translation WHERE scope='field' AND ref_key=N'附件1'")).map(r => r.locale)));
await pool.close();
