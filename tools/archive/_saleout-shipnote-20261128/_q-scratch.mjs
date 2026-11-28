// 一次性探针:node _scratch/_q.mjs "SQL"  [db]
// 读 deploy/config.json 的连接信息,输出 TSV(表头 + 行)。
import { readFileSync } from 'node:fs';
import sql from 'mssql';

const cfg = JSON.parse(readFileSync(new URL('../deploy/config.json', import.meta.url), 'utf8'));
const db = cfg.database;
const pool = await sql.connect({
  server: db.server, port: db.port, user: db.user, password: db.password,
  database: process.argv[3] || db.database, options: { encrypt: !!db.encrypt, trustServerCertificate: true },
  requestTimeout: 120000,
});
const text = process.argv[2] || 'SELECT 1';
try {
  const r = await pool.request().query(text);
  for (const rs of r.recordsets || []) {
    if (!rs.columns) continue;
    const cols = Object.keys(rs.columns);
    console.log(cols.join('\t'));
    for (const row of rs) console.log(cols.map((c) => (row[c] === null ? '∅' : String(row[c]).replace(/\r?\n/g, '⏎'))).join('\t'));
    console.log(`-- ${rs.rowsAffected?.[0] ?? rs.length} 行`);
  }
} catch (e) {
  console.error('SQL ERROR:', e.message);
  process.exitCode = 1;
} finally {
  await pool.close();
}
