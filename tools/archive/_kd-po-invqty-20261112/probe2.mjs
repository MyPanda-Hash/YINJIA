// 探针2(2026-11-12):判定采购订单行 inv_qty 是「制单时快照」还是「每次读实时算」
// 做法:同一批历史采购订单(同一物料、日期跨好几个月)在**同一次运行**里逐个取详情:
//   - 若各行 inv_qty 相同  ⇒ 实时库存(读的时候现算)
//   - 若各不相同、且与单据日期相关 ⇒ 制单/保存时存下来的快照
// 只读。用法: node tools/archive/_kd-po-invqty-20261112/probe2.mjs
import { readFileSync } from 'node:fs';

const ROOT = new URL('../../../', import.meta.url);
const { fetchAppToken, kingdeeGet } = await import(new URL('deploy/kingdee-client.mjs', ROOT).href);
const cfg = JSON.parse(readFileSync(new URL('deploy/config.json', ROOT), 'utf8').replace(/^\uFEFF/, ''));
const { token } = await fetchAppToken(cfg.kingdee);
const { default: mssql } = await import(new URL('deploy/node_modules/mssql/index.js', ROOT).href);

const MATERIAL = process.argv[2] || 'YJ-XH-001';
const pool = await mssql.connect({ ...cfg.database, options: { encrypt: false, trustServerCertificate: true } });
const rs = await pool.request().input('m', mssql.NVarChar, MATERIAL).query(`
  SELECT l.[单据编号] AS bill_no, CONVERT(varchar(10), h.[单据日期], 23) AS bill_date, l.[数量] AS qty, l.[现存量] AS mes_inv,
         h.[外部数据ID] AS kd_id
  FROM bl_pu_order l LEFT JOIN bd_pu_order h ON h.[单据编号]=l.[单据编号]
  WHERE l.[物料编码]=@m ORDER BY h.[单据日期]`);
await pool.close();

console.log(`物料 ${MATERIAL}:MES 内 ${rs.recordset.length} 张采购订单,逐个取金蝶详情(同一时刻)\n`);
console.log('单据日期   | 单据编号        | 数量    | MES库内现存量 | 金蝶现在返回 | 一致?');
for (const r of rs.recordset) {
  if (!r.kd_id) { console.log(`${r.bill_date} | ${r.bill_no} | 库内无外部数据ID,跳过`); continue; }
  const d = await kingdeeGet(cfg.kingdee, token, '/jdy/v2/scm/pur_order_detail', { id: r.kd_id });
  const me = (d.material_entity || []).find((x) => x.material_number === MATERIAL) || (d.material_entity || [])[0] || {};
  const now = me.inv_qty;
  const eq = Number(now) === Number(r.mes_inv);
  console.log(`${r.bill_date} | ${r.bill_no} | ${r.qty} | ${r.mes_inv} | ${now} | ${eq ? 'yes' : 'NO'}`);
}
