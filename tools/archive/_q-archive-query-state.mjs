import { createRequire } from 'node:module';
const mssql = createRequire('D:/jdy-sync/package.json')('mssql');
const pool = await new mssql.ConnectionPool({ server:'127.0.0.1', port:1433, database:'HSDZ_MES', user:'yinjia', password:'Yinjia@2026', options:{encrypt:false,trustServerCertificate:true} }).connect();
const q = async (s) => (await new mssql.Request(pool).query(s)).recordset;
const panels = await q("SELECT panel_code, panel_name, line_table FROM yj_panel WHERE mode='archive' ORDER BY panel_code");
console.log('基础资料面板数:', panels.length);
let noQuery = [], few = [];
for (const p of panels) {
  const rows = await q(`SELECT label, place, hidden, visible FROM yj_field WHERE panel_code=N'${p.panel_code}'`);
  const visible = rows.filter(r => !r.hidden && r.visible);
  const qs = rows.filter(r => String(r.place||'').includes('query')).map(r => r.label);
  let n = 0; try { n = (await q(`SELECT COUNT(*) n FROM ${p.line_table} WHERE ISNULL(asp_cancel,'N')<>'Y'`))[0].n; } catch {}
  if (!qs.length) noQuery.push(`${p.panel_code}(${p.panel_name},${n}行)`);
  else if (qs.length <= 2) few.push(`${p.panel_code}:${JSON.stringify(qs)}`);
}
console.log('\n【无任何 query 位字段的面板】', noQuery.length, JSON.stringify(noQuery));
console.log('\n【query 位 ≤2 个的面板】', few.length, JSON.stringify(few));
console.log('\n样例(商品 INV / 供应商 GFDA / 客户 KHDA)的 query 位:');
for (const pc of ['INV','GFDA','KHDA','EMP','DEPT','WH']) {
  const rows = await q(`SELECT label, place, hidden, visible FROM yj_field WHERE panel_code=N'${pc}' ORDER BY seq`);
  console.log(`  ${pc}: 可见字段=${rows.filter(r=>!r.hidden&&r.visible).length} query位=${JSON.stringify(rows.filter(r=>String(r.place||'').includes('query')).map(r=>r.label))}`);
}
await pool.close();
