/**
 * 只读探针(MES 侧):采购订单头/行 + 金蝶回传的「行已执行/未执行数量/行入库状态」+ form_flow_link 占用。
 * 用法:cd deploy; node _q-po-erp-qty-sync-20261123.mjs YJ-20261112-10 [更多单号...]
 * 口径与结论见 deploy/采购订单未完成数量-MES与金蝶口径差-20261123.md
 */
import mssql from 'mssql';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(readFileSync(join(HERE, 'config.json'), 'utf8'));
const DB = process.env.YINJIA_SQL_DB || cfg.database.database;
const pool = await mssql.connect({
  server: cfg.database.server, port: cfg.database.port, database: DB,
  user: cfg.database.user, password: cfg.database.password,
  options: { encrypt: false, trustServerCertificate: true }, requestTimeout: 120000,
});
const q = async (sql, params) => {
  const r = new mssql.Request(pool);
  if (params) for (const [k, v] of Object.entries(params)) r.input(k, v);
  return (await r.query(sql)).recordset;
};
const show = (t, rows) => {
  console.log(`\n=== ${t} (${rows.length}) ===`);
  for (const r of rows) console.log(JSON.stringify(r));
};

const POS = process.argv.slice(2);
const list = POS.map((_, i) => `@p${i}`).join(',');
const params = Object.fromEntries(POS.map((p, i) => [`p${i}`, p]));

try {
  show('订单头', await q(`
    SELECT h.单据编号, h.单据日期, h.供应商, h.ERP单号, s.shr, s.stopped, s.erp_close_state, s.canceled
      FROM bd_pu_order h LEFT JOIN yj_doc_status s
        ON s.panel_code='PU_ORDER' AND s.doc_no=h.单据编号
     WHERE h.单据编号 IN (${list})`, params));

  show('订单行(含金蝶回传的执行/入库状态)', await q(`
    SELECT 单据编号, id, 行号, 物料编码, 数量, 基本数量,
           行已执行数量, 行未执行数量, 行执行状态, 行入库状态, 行关闭状态, 退货数量
      FROM bl_pu_order WHERE 单据编号 IN (${list}) ORDER BY 单据编号, TRY_CAST(行号 AS int)`, params));

  show('MES 占用(form_flow_link 汇总,含 RELEASED)', await q(`
    SELECT source_form_no, source_line_key, target_panel_code, link_status,
           COUNT(*) 条数, SUM(linked_quantity) 占用
      FROM form_flow_link WHERE source_form_no IN (${list})
     GROUP BY source_form_no, source_line_key, target_panel_code, link_status
     ORDER BY source_form_no, source_line_key`, params));

  show('下游单据去重', await q(`
    SELECT DISTINCT target_panel_code, target_form_no FROM form_flow_link
     WHERE source_form_no IN (${list}) ORDER BY target_panel_code`, params));
} finally { await pool.close(); }
