import mssql from 'mssql';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(readFileSync(join(HERE, 'config.json'), 'utf8'));
const pool = await mssql.connect({
  server: cfg.database.server, port: cfg.database.port, database: cfg.database.name || cfg.database.database,
  user: cfg.database.user, password: cfg.database.password,
  options: { encrypt: false, trustServerCertificate: true }, requestTimeout: 120000,
});
const q = async (sql, params) => {
  const r = new mssql.Request(pool);
  if (params) for (const [k, v] of Object.entries(params)) r.input(k, v);
  return (await r.query(sql)).recordset;
};
try {
  const rows = await q(`
    SELECT id, panel_code, label, col_name, place, visible, hidden, seq, data_type
      FROM yj_field
     WHERE panel_code = N'PU_ORDER'
       AND (label LIKE N'%执行%' OR label LIKE N'%入库%' OR label LIKE N'%关闭%' OR col_name LIKE N'%执行%' OR col_name LIKE N'%入库%')
     ORDER BY place, seq`);
  console.log(`== PU_ORDER 里与「执行/入库」相关的字段 (${rows.length}) ==`);
  for (const r of rows) console.log(JSON.stringify(r));
  const cnt = await q(`SELECT place, COUNT(*) n FROM yj_field WHERE panel_code=N'PU_ORDER' GROUP BY place`);
  console.log('\n== PU_ORDER 字段 place 分布 ==');
  for (const r of cnt) console.log(JSON.stringify(r));
} finally { await pool.close(); }
