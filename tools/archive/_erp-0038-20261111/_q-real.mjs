// 只读取证(真实账套 359797):PI-2026-11-0038 报「单据已关闭不允许下推或商品需检验,请先生成收料通知」
// 运行: node tools/archive/_erp-0038-20261111/_q-real.mjs
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchAppToken, kingdeeGet, kingdeeTryGet } from '../../../deploy/kingdee-client.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(readFileSync(resolve(here, '../../../deploy/config.json'), 'utf8').replace(/^\uFEFF/, '')).kingdee;
console.log('账套 clientId=', cfg.clientId, ' outerInstanceId=', cfg.outerInstanceId);
const { token, domain } = await fetchAppToken(cfg);
cfg.domain = domain;
console.log('token ok');

const PO = process.argv[2] || 'YJ-20261103-07';
const ERP_NO = process.argv[3] || 'CGRK-20261111-03675';
const MATERIAL = process.argv[4] || 'YJ-YCYX-020';

// ── 1. 采购订单头/分录 ──
const list = await kingdeeGet(cfg, token, '/jdy/v2/scm/pur_order', { page: '1', page_size: '10', bill_no: PO });
const rows = list.rows || [];
console.log('\n=== pur_order 列表命中 ' + rows.length + ' 条 ===');
for (const r of rows) console.log(JSON.stringify({ id: r.id, bill_no: r.bill_no, bill_date: r.bill_date, bill_status: r.bill_status, io_status: r.io_status, bill_close_state: r.bill_close_state }));
const hit = rows.find((r) => r.bill_no === PO) || rows[0];
if (!hit) { console.log('订单未命中'); }
else {
  const d = await kingdeeGet(cfg, token, '/jdy/v2/scm/pur_order_detail', { id: String(hit.id) });
  console.log('\n=== 订单头 ===');
  console.log(JSON.stringify({ bill_no: d.bill_no, bill_date: d.bill_date, bill_status: d.bill_status, io_status: d.io_status, bill_close_state: d.bill_close_state, supplier_name: d.supplier_name, supplier_number: d.supplier_number, remark: d.remark }, null, 1));
  const ents = d.material_entity || [];
  const keys = ['seq', 'material_number', 'material_name', 'unit_name', 'qty', 'in_qty', 'un_out_qty', 'close_state', 'io_status', 'entry_close_state'];
  console.log('\n=== 分录(' + ents.length + '行;close_state 0已关闭/1未关闭/2手动关闭) ===');
  console.log(keys.join(' | '));
  for (const e of ents) console.log(keys.map((k) => (e[k] === undefined || e[k] === null ? '' : e[k])).join(' | '));
  console.log('\n=== 目标行(YJ-YCYX-020)原始键 ===');
  const mine = ents.filter((e) => e.material_number === MATERIAL);
  console.log('命中 ' + mine.length + ' 行');
  for (const e of mine) {
    const brief = {};
    for (const k of Object.keys(e)) if (!/amount|price|discount|tax|cess/i.test(k)) brief[k] = e[k];
    console.log(JSON.stringify(brief, null, 1).slice(0, 2500));
  }
}

// ── 2. MES 回写的 ERP 单号在金蝶是否存在 / 内容 ──
for (const no of [ERP_NO]) {
  const t = await kingdeeTryGet(cfg, token, '/jdy/v2/scm/pur_inbound', { page: '1', page_size: '10', bill_no: no });
  const rs = t.ok ? ((t.data && t.data.rows) || []) : [];
  console.log('\n=== pur_inbound bill_no=' + no + ' → ' + (t.ok ? rs.length + ' 条' : '查询失败 ' + t.error) + ' ===');
  for (const r of rs) console.log(JSON.stringify({ id: r.id, bill_no: r.bill_no, bill_date: r.bill_date, bill_status: r.bill_status, io_status: r.io_status, bill_close_state: r.bill_close_state, supplier_name: r.supplier_name }, null, 0));
  if (rs[0]) {
    const dd = await kingdeeGet(cfg, token, '/jdy/v2/scm/pur_inbound_detail', { id: String(rs[0].id) });
    const e2 = dd.material_entity || [];
    console.log('  行:');
    for (const e of e2) console.log('   ' + ['seq', 'material_number', 'material_name', 'qty', 'batch_no', 'src_bill_no', 'src_seq', 'close_state'].map((k) => k + '=' + (e[k] ?? '')).join(' '));
  }
}

// ── 3. 挂在该订单上的所有采购入库单 ──
const inb = await kingdeeTryGet(cfg, token, '/jdy/v2/scm/pur_inbound', { page: '1', page_size: '50', src_bill_no: PO });
if (inb.ok) {
  const rs = (inb.data && inb.data.rows) || [];
  console.log('\n=== src_bill_no=' + PO + ' 的采购入库单 ' + rs.length + ' 张 ===');
  for (const r of rs) console.log([r.bill_no, r.bill_date, r.bill_status, r.io_status].join(' | '));
} else console.log('\nsrc_bill_no 过滤不支持: ' + inb.error);

// ── 4. 商品档案:检验相关键 ──
const mat = await kingdeeTryGet(cfg, token, '/jdy/v2/bd/material', { page: '1', page_size: '5', number: MATERIAL });
const mrow = mat.ok ? ((mat.data && mat.data.rows) || [])[0] : null;
if (mrow) {
  const md = await kingdeeGet(cfg, token, '/jdy/v2/bd/material_detail', { id: String(mrow.id) });
  const brief = {};
  for (const k of Object.keys(md)) if (!/amount|price|discount|tax|cess|image|pic/i.test(k)) brief[k] = md[k];
  console.log('\n=== 商品 ' + MATERIAL + ' 详情键(找需检验标志) ===');
  const s = JSON.stringify(brief, null, 1);
  console.log(s.length > 6000 ? s.slice(0, 6000) + '\n…(截断)' : s);
  console.log('\n=== 疑似检验相关键 ===');
  for (const k of Object.keys(md)) if (/qc|insp|check|quality|test/i.test(k)) console.log('  ' + k + ' = ' + JSON.stringify(md[k]));
} else {
  console.log('\n商品 ' + MATERIAL + ' 未查到: ' + (mat.ok ? '列表为空' : mat.error));
}
