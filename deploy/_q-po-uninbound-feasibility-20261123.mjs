/**
 * 只读探针:评估「采购订单明细里直接显示金蝶未入库数量」可行性
 * ① 字段现状(可见性/seq/类型/近邻列) ② 译名 ③ 存量数据填充度 ④ 同步是否支持强刷
 * 用法:cd deploy; node _q-po-uninbound-feasibility-20261123.mjs
 */
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
  show('① 该字段 + 近邻明细字段(seq 900~1000)', await q(`
    SELECT id, label, col_name, data_type, place, visible, hidden, seq, width, dict_sql
      FROM yj_field WHERE panel_code=N'PU_ORDER' AND place=N'detail' AND seq BETWEEN 900 AND 1000
     ORDER BY seq, id`));

  show('② 现有可见明细列(最后 12 个)', await q(`
    SELECT TOP 12 id, label, col_name, seq, visible, hidden
      FROM yj_field WHERE panel_code=N'PU_ORDER' AND place=N'detail' AND visible=1 AND ISNULL(hidden,0)=0
     ORDER BY seq DESC`));

  show('③ 译名(行未执行数量 / 金蝶未入库 / 未执行)', await q(`
    SELECT scope, ref_key, locale, text, source FROM yj_translation
     WHERE ref_key IN (N'行未执行数量', N'行已执行数量', N'行入库状态', N'金蝶未入库数量')
     ORDER BY ref_key, locale`));

  show('④ 存量填充度(全库 / 近 60 天单据)', await q(`
    SELECT COUNT(*) AS 总行数,
           SUM(CASE WHEN 行未执行数量 IS NULL OR LTRIM(RTRIM(行未执行数量))=N'' THEN 1 ELSE 0 END) AS 空值行,
           SUM(CASE WHEN 行未执行数量 IS NOT NULL AND LTRIM(RTRIM(行未执行数量))<>N'' THEN 1 ELSE 0 END) AS 有值行
      FROM bl_pu_order`));

  show('④b 有值行按单据年份分布', await q(`
    SELECT LEFT(CAST(h.单据日期 AS nvarchar(10)),4) AS 年, COUNT(*) AS 行数,
           SUM(CASE WHEN L.行未执行数量 IS NOT NULL AND LTRIM(RTRIM(L.行未执行数量))<>N'' THEN 1 ELSE 0 END) AS 有值行
      FROM bl_pu_order L JOIN bd_pu_order h ON h.单据编号=L.单据编号
     GROUP BY LEFT(CAST(h.单据日期 AS nvarchar(10)),4) ORDER BY 年 DESC`));

  show('⑤ 列类型', await q(`
    SELECT c.name, TYPE_NAME(c.user_type_id) AS t, c.max_length, c.is_nullable
      FROM sys.columns c WHERE c.object_id=OBJECT_ID(N'dbo.bl_pu_order')
       AND c.name IN (N'行未执行数量', N'行已执行数量', N'行入库状态', N'行执行状态', N'行关闭状态', N'行号')`));
} finally { await pool.close(); }
