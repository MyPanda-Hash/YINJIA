// 诊断:列出采购两张表所有 NOT NULL 列(修正映射用)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(readFileSync(join(HERE, 'config.json'), 'utf8').replace(/^\uFEFF/, ''));
const mssql = (await import('mssql')).default;
const pool = new mssql.ConnectionPool({
  server: cfg.database.server, port: cfg.database.port || 1433,
  database: cfg.database.database, user: cfg.database.user, password: cfg.database.password,
  options: { encrypt: !!cfg.database.encrypt, trustServerCertificate: true },
});
await pool.connect();
const r = await new mssql.Request(pool).query(`
  SELECT t.name AS tbl, c.name AS col, c.is_nullable AS nullable, dc.definition AS dflt
  FROM sys.columns c
  JOIN sys.tables t ON t.object_id = c.object_id
  LEFT JOIN sys.default_constraints dc ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id
  WHERE t.name IN ('bd_pu_order','bl_pu_order') AND c.is_nullable = 0
  ORDER BY t.name, c.column_id`);
console.table(r.recordset);
await pool.close();
