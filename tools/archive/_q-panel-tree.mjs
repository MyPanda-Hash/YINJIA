// 一次性探针:聚焦查销售/采购/库存相关面板与字段(只读)
import { createRequire } from 'node:module';
const require = createRequire('D:/YINJIA-main/deploy/package.json');
const mssql = require('mssql');

const pool = new mssql.ConnectionPool({
  server: '127.0.0.1', port: 1433, database: 'HSDZ_MES',
  user: 'yinjia', password: 'Yinjia@2026',
  options: { encrypt: false, trustServerCertificate: true },
});
await pool.connect();

const all = (await new mssql.Request(pool).query(
  `SELECT panel_code, panel_name, category, mode, line_table, module_group, panel_name_en
     FROM yj_panel ORDER BY panel_code`)).recordset;

console.log(`=== 全部 ${all.length} 个面板:按 module_group 分组 ===`);
const byGroup = {};
for (const p of all) (byGroup[p.module_group || '(空)'] ||= []).push(p);
for (const [g, arr] of Object.entries(byGroup)) {
  console.log(`\n【${g}】${arr.length} 个`);
  for (const p of arr) console.log(`  ${p.panel_code.padEnd(26)} ${p.panel_name.padEnd(22)} ${p.category.padEnd(6)} ${p.mode.padEnd(8)} ${p.line_table || ''}`);
}

console.log('\n=== 名称含「汇总」或「统计」的面板 ===');
for (const p of all) if (/汇总|统计/.test(p.panel_name)) console.log(`  ${p.panel_code} | ${p.panel_name} | ${p.category} | ${p.mode} | ${p.line_table}`);

console.log('\n=== SO_/PU_ 前缀面板的字段数 ===');
const f = (await new mssql.Request(pool).query(
  `SELECT panel_code, COUNT(*) AS n FROM yj_field WHERE panel_code LIKE 'SO[_]%' OR panel_code LIKE 'PU[_]%'
     GROUP BY panel_code ORDER BY panel_code`)).recordset;
for (const r of f) console.log(`  ${r.panel_code}: ${r.n} 字段`);

await pool.close();
