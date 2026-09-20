// 一次性探针:看 PU_ORDER / SO_ORDER 的 yj_panel.config 内容与相关字段(只读)
import { createRequire } from 'node:module';
const require = createRequire('D:/YINJIA-main/deploy/package.json');
const mssql = require('mssql');

const pool = new mssql.ConnectionPool({
  server: '127.0.0.1', port: 1433, database: 'HSDZ_MES',
  user: 'yinjia', password: 'Yinjia@2026',
  options: { encrypt: false, trustServerCertificate: true },
});
await pool.connect();

for (const code of ['PU_ORDER', 'SO_ORDER', 'PU_REQ', 'SALES_ORDER_STATS', 'PURCHASE_IN']) {
  const r = (await new mssql.Request(pool)
    .input('c', mssql.VarChar(40), code)
    .query(`SELECT panel_code, panel_name, category, mode, config_at, config FROM yj_panel WHERE panel_code = @c`))
    .recordset[0];
  if (!r) { console.log(`\n### ${code}: 不存在`); continue; }
  console.log(`\n### ${r.panel_code} ${r.panel_name} (${r.category}/${r.mode}) config_at=${r.config_at}`);
  console.log('config 长度:', r.config ? r.config.length : 0);
  if (r.config) {
    const cfg = JSON.parse(r.config);
    console.log('config 顶层键:', Object.keys(cfg).join(', '));
    // 找可能承载"关联面板/汇总表"的键
    for (const k of Object.keys(cfg)) {
      const v = cfg[k];
      if (/汇总|统计|关联|面板|panel|child|tab|relat|sub/i.test(k)) {
        console.log(`  [${k}] = ${JSON.stringify(v).slice(0, 600)}`);
      }
    }
  }
}

console.log('\n=== yj_field 中标签含「汇总/统计」的行 ===');
const fs = (await new mssql.Request(pool).query(
  `SELECT panel_code, field_name, label FROM yj_field WHERE label LIKE N'%汇总%' OR label LIKE N'%统计%' ORDER BY panel_code`)).recordset;
for (const r of fs) console.log(`  ${r.panel_code} | ${r.field_name} | ${r.label}`);

console.log('\n=== 所有含 config 的面板及顶层键 ===');
const cs = (await new mssql.Request(pool).query(
  `SELECT panel_code, panel_name, config FROM yj_panel WHERE config IS NOT NULL ORDER BY panel_code`)).recordset;
for (const r of cs) {
  let keys = [];
  try { keys = Object.keys(JSON.parse(r.config)); } catch { keys = ['<解析失败>']; }
  console.log(`  ${r.panel_code} ${r.panel_name}: ${keys.join(', ')}`);
}

await pool.close();
