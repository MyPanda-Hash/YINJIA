// 探针:EXTRA/EXTRA_LINES 里 SALE_OUT 的目标列 与 物理列 的差集(缺列会让整单写入失败)
import { readFileSync } from 'node:fs';
import sql from 'mssql';
import { EXTRA, EXTRA_LINES } from './kingdee-extra-fields.mjs';

const cfg = JSON.parse(readFileSync(new URL('./config.json', import.meta.url), 'utf8'));
const db = cfg.database;
const pool = await sql.connect({
  server: db.server, port: db.port, user: db.user, password: db.password,
  database: db.database, options: { encrypt: !!db.encrypt, trustServerCertificate: true },
});
const colsOf = async (t) => new Set((await pool.request().query(
  `SELECT name FROM sys.columns WHERE object_id=OBJECT_ID('${t}')`)).recordset.map((r) => r.name));
const head = await colsOf('bd_sale_out');
const line = await colsOf('bl_sale_out');
const missHead = (EXTRA.SALE_OUT || []).map((x) => x.c).filter((c) => !head.has(c));
const missLine = (EXTRA_LINES.SALE_OUT || []).map((x) => x.c).filter((c) => !line.has(c));
console.log('头表缺列:', missHead.length ? missHead.join(', ') : '(无)');
console.log('行表缺列:', missLine.length ? missLine.join(', ') : '(无)');
// 反向:物理列里有、但 yj_field 没登记的(不影响同步,仅参考)
console.log('头物理列数', head.size, '/ 行物理列数', line.size);
await pool.close();
