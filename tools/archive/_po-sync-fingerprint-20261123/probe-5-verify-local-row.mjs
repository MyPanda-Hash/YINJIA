// 只读:验证本机账套里 YJ-20261117-01 现在是否 = 金蝶(3 行 100/15/70,审核时间 11-23 14:03)
import { readFileSync } from 'node:fs';
const cfg = JSON.parse(readFileSync(new URL('../../../deploy/config.json', import.meta.url), 'utf8'));
const sql = (await import('../../../deploy/node_modules/mssql/index.js')).default;
const pool = await sql.connect({
  server: cfg.database.server, port: cfg.database.port, database: cfg.database.database,
  user: cfg.database.user, password: cfg.database.password,
  options: { encrypt: false, trustServerCertificate: true },
});
const no = process.argv[2] || 'YJ-20261117-01';
const h = await pool.request().input('no', no).query(`
  SELECT 单据编号, 审核人, 审核时间, 关闭状态, [入库状态Z部分入库，C全部入库，A未入库] AS 入库状态,
         外部指纹, asp_user1, asp_time2
  FROM bd_pu_order WHERE 单据编号=@no`);
console.log('头:', JSON.stringify(h.recordset[0]));
const l = await pool.request().input('no', no).query(`
  SELECT id, 行号, 物料编码, 数量, 单价, 金额 FROM bl_pu_order WHERE 单据编号=@no ORDER BY 行号`);
console.table(l.recordset);
await pool.close();

