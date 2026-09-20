/**
 * _q-pi-orders.mjs — 采购入库单五字段:金蝶接口实测(只读 GET,不写任何数据)
 * 用法: node tools/archive/_q-pi-orders.mjs
 * 输出: tools/archive/_q-pi-orders.out.json
 *   ①pur_inbound 详情里 源单族(src_bill_no/src_seq)/客户(customer_*)/基本数量(base_qty) 实际取值
 *   ②头/行 custom_field 容器里账套真实定义了哪些自定义字段键(是否来料检验取证)
 *   ③pur_order 采样(pur_order.base_qty=订单基本数量;customer_*=采购订单上的客户)
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fetchAppToken, kingdeeGet } from '../../deploy/kingdee-client.mjs';

const CFG_PATH = '../../deploy/config.json';
const cfgPath = new URL(CFG_PATH, import.meta.url);
if (!existsSync(cfgPath)) { console.error('缺 deploy/config.json(凭证,不入库)'); process.exit(1); }
const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
const k = cfg.kingdee || cfg;
// 只印账套标识指纹,不印任何密钥
const mask = (s) => (s ? String(s).slice(0, 4) + '…(' + String(s).length + ')' : '(空)');
console.log('[账套] outerInstanceId=' + mask(k.outerInstanceId) + ' domain=' + (k.domain || ''));

const { token } = await fetchAppToken(k);
const out = { purInbound: {}, customFields: {}, purOrder: {} };

// ── ① 采购入库单:找有源单(采购订单)的行 ──
const list = await kingdeeGet(k, token, '/jdy/v2/scm/pur_inbound', { page: '1', page_size: '50' });
console.log(`[pur_inbound] 列表 count=${list.count} 本页=${(list.rows || []).length}`);
const rows = list.rows || [];
const hdrCfKeys = new Set();
const lineCfKeys = new Set();
let custFilled = 0;
const samples = [];
for (const r of rows) {
  const d = await kingdeeGet(k, token, '/jdy/v2/scm/pur_inbound_detail', { id: r.id });
  Object.keys(d.custom_field || {}).forEach((x) => hdrCfKeys.add(x));
  for (const e of (d.material_entity || [])) Object.keys(e.custom_entity_field || {}).forEach((x) => lineCfKeys.add(x));
  if (String(d.customer_name || '').trim()) custFilled++;
  const lines = (d.material_entity || []).map((e) => ({
    商品编码: e.material_number, 数量: e.qty, 基本数量: e.base_qty,
    源单编号: e.src_bill_no, 源单行号: e.src_seq, 源单类型: e.src_bill_type_name, 源单日期: e.src_bill_date,
    行自定义字段键: Object.keys(e.custom_entity_field || {}),
  }));
  samples.push({
    bill_no: d.bill_no, 单据日期: d.bill_date, 单据状态: d.bill_status,
    客户: d.customer_name, 客户编码: d.customer_number, 供应商: d.supplier_name,
    部门: d.dept_name, 仓库: d.bill_stock_name,
    有源单的行数: lines.filter((x) => x.源单编号).length, 行数: lines.length,
    行: lines,
  });
}
out.purInbound = { count: Number(list.count), 采样单数: rows.length, 采样中客户有值: custFilled, 单据: samples };
console.log(`[pur_inbound] 采样 ${rows.length} 单:客户有值 ${custFilled} 单;`
  + ` 有源单的行合计 ${samples.reduce((a, s) => a + s.有源单的行数, 0)} 行`);
out.customFields = { 头_custom_field键: [...hdrCfKeys], 行_custom_entity_field键: [...lineCfKeys] };
console.log('[custom_field] 头键=' + JSON.stringify([...hdrCfKeys]) + ' 行键=' + JSON.stringify([...lineCfKeys]));

// ── ③ 采购订单采样(对照:订单基本数量/客户) ──
const pol = await kingdeeGet(k, token, '/jdy/v2/scm/pur_order', { page: '1', page_size: '3' });
const poSamples = [];
for (const r of (pol.rows || []).slice(0, 3)) {
  const d = await kingdeeGet(k, token, '/jdy/v2/scm/pur_order_detail', { id: r.id });
  poSamples.push({
    bill_no: d.bill_no, 客户: d.customer_name, 客户编码: d.customer_number, 供应商: d.supplier_name,
    行: (d.material_entity || []).slice(0, 3).map((e) => ({
      商品编码: e.material_number, 数量: e.qty, 基本数量: e.base_qty, 行号: e.seq,
      已执行数量: e.in_qty, 行入库状态: e.entry_realio_status,
    })),
  });
}
out.purOrder = { count: Number(pol.count), 采样: poSamples };
console.log('[pur_order] count=' + pol.count + ' 采样=' + poSamples.length);

writeFileSync(new URL('./_q-pi-orders.out.json', import.meta.url), JSON.stringify(out, null, 2), 'utf8');
console.log('已写出 tools/archive/_q-pi-orders.out.json');
