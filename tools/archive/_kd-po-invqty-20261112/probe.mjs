// 探针(2026-11-12):金蝶真实账套「采购订单有没有现存量(inv_qty)」取证
// 目的:①确认 pur_order_detail 行上是否真带 inv_qty;②带的是什么值(空/0/正/负);
//      ③是不是实时现存量 —— 拿库里已同步的同一张单,与金蝶现在返回的值对比。
// 只读,不写库、不写金蝶。用法(在 deploy/ 同级任意目录均可):
//   node tools/archive/_kd-po-invqty-20261112/probe.mjs
import { readFileSync } from 'node:fs';

const ROOT = new URL('../../../', import.meta.url); // 仓库根
const { fetchAppToken, kingdeeGet } = await import(new URL('deploy/kingdee-client.mjs', ROOT).href);
const cfg = JSON.parse(readFileSync(new URL('deploy/config.json', ROOT), 'utf8').replace(/^\uFEFF/, ''));
const { token } = await fetchAppToken(cfg.kingdee);
console.log(`账套 clientId=${cfg.kingdee.clientId}（359797 = 真实账套）`);

const LIST = '/jdy/v2/scm/pur_order';
const DETAIL = '/jdy/v2/scm/pur_order_detail';

// ① 列表行有没有 inv_qty 键
const l = await kingdeeGet(cfg.kingdee, token, LIST, { page: '1', page_size: '20', bill_status: 'C' });
const lr = (l.rows || [])[0] || {};
console.log(`\n【列表接口】${l.rows?.length} 行;首行键 ${Object.keys(lr).length} 个;has inv_qty(表头)? ${'inv_qty' in lr}`);
console.log(`  列表行 material_entity 条目数 = ${(lr.material_entity || []).length};首条目 has inv_qty? ${'inv_qty' in ((lr.material_entity || [])[0] || {})}`);

// ② 详情:逐单统计行 inv_qty 的取值形态
const stat = { orders: 0, lines: 0, hasKey: 0, nullOrEmpty: 0, zero: 0, pos: 0, neg: 0, samples: [] };
const picked = []; // 同时记录「金蝶现在给的值」,供③与库里对比
for (const r of l.rows || []) {
  const d = await kingdeeGet(cfg.kingdee, token, DETAIL, { id: r.id });
  const lines = d.material_entity || [];
  if (!lines.length) continue;
  stat.orders++;
  for (const m of lines) {
    stat.lines++;
    const has = 'inv_qty' in m;
    if (has) stat.hasKey++;
    const v = m.inv_qty;
    if (v === null || v === undefined || v === '') stat.nullOrEmpty++;
    else if (Number(v) === 0) stat.zero++;
    else if (Number(v) > 0) stat.pos++;
    else stat.neg++;
  }
  const me = lines[0];
  picked.push({
    bill_no: d.bill_no, bill_date: d.bill_date, io_status: d.io_status,
    material: me.material_number, name: me.material_name,
    qty: me.qty, stock_name: me.stock_name ?? null,
    inv_qty: me.inv_qty ?? null, inv_base_qty: me.inv_base_qty ?? null,
    lineKeys: Object.keys(me).length,
  });
}
console.log(`\n【详情接口】${stat.orders} 单 / ${stat.lines} 行`);
console.log(`  带 inv_qty 键的行: ${stat.hasKey}/${stat.lines};空值 ${stat.nullOrEmpty} · 0 ${stat.zero} · 正 ${stat.pos} · 负 ${stat.neg}`);
console.log('  采样(每单首行):');
for (const p of picked) {
  console.log(`   ${p.bill_no} ${p.bill_date} ${p.material} qty=${p.qty} 仓库=${p.stock_name} inv_qty=${p.inv_qty} inv_base_qty=${p.inv_base_qty} 行键数=${p.lineKeys}`);
}

// ③ 与 MES 库内已同步值对比(判断是不是「实时」)
const { default: mssql } = await import(new URL('deploy/node_modules/mssql/index.js', ROOT).href);
const pool = await mssql.connect({ ...cfg.database, options: { encrypt: false, trustServerCertificate: true } });
console.log('\n【与 MES 已同步值对比】');
let diff = 0, same = 0, miss = 0;
for (const p of picked) {
  const rs = await pool.request()
    .input('no', mssql.NVarChar, p.bill_no)
    .query(`SELECT TOP 1 [现存量] AS v FROM bl_pu_order WHERE [单据编号]=@no ORDER BY [行号]`);
  if (!rs.recordset.length) { miss++; continue; }
  const mv = rs.recordset[0].v;
  const a = p.inv_qty === null || p.inv_qty === undefined ? null : Number(p.inv_qty);
  const b = mv === null || mv === undefined ? null : Number(mv);
  const eq = (a === null && b === null) || (a !== null && b !== null && Math.abs(a - b) < 1e-9);
  if (eq) same++; else { diff++; console.log(`   差异 ${p.bill_no} ${p.material}: 金蝶现在=${a} MES库内=${b}`); }
}
console.log(`   一致 ${same} · 不一致 ${diff} · 库内无此单 ${miss}`);
await pool.close();
