import mssql from 'mssql';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(readFileSync(join(HERE, 'config.json'), 'utf8'));
const pool = await mssql.connect({
  server: cfg.database.server, port: cfg.database.port, database: cfg.database.database,
  user: cfg.database.user, password: cfg.database.password,
  options: { encrypt: false, trustServerCertificate: true }, requestTimeout: 120000,
});
const q = async (sql, params) => {
  const r = new mssql.Request(pool);
  if (params) for (const [k, v] of Object.entries(params)) r.input(k, v);
  return (await r.query(sql)).recordset;
};
const show = (t, rows) => { console.log(`\n=== ${t} (${rows.length}) ===`); for (const r of rows) console.log(JSON.stringify(r)); };

try {
  show('yj_field_view 结构', await q(`
    SELECT name, TYPE_NAME(user_type_id) t FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.yj_field_view')`));
  show('PU_ORDER 的角色字段视图行', await q(`
    SELECT * FROM yj_field_view WHERE panel_code=N'PU_ORDER'`));
  show('是否存在角色视图覆盖「行未执行数量」', await q(`
    SELECT v.* FROM yj_field_view v WHERE v.field_id IN (SELECT id FROM yj_field WHERE label=N'行未执行数量')`));
  show('该 5 个字段的完整注册行', await q(`
    SELECT id, label, col_name, data_type, place, visible, hidden, seq, width, required, read_only
      FROM yj_field WHERE panel_code=N'PU_ORDER'
       AND label IN (N'行未执行数量', N'行已执行数量', N'行入库状态', N'行执行状态', N'行关闭状态')`));
  show('明细里 seq 最接近的中段字段(40~130)', await q(`
    SELECT id, label, seq, visible, hidden FROM yj_field
     WHERE panel_code=N'PU_ORDER' AND place=N'detail' AND seq BETWEEN 30 AND 130 AND visible=1 AND ISNULL(hidden,0)=0
     ORDER BY seq`));
} finally { await pool.close(); }
