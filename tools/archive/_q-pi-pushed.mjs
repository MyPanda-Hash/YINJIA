/**
 * _q-pi-pushed.mjs — MES 已转ERP的采购入库单在金蝶侧长什么样(来源单族字段是否落上)
 * 用法: node tools/archive/_q-pi-pushed.mjs
 * 依据:MES 头表 ERP单号(转ERP回写) → 金蝶 pur_inbound 详情逐单核对 src_bill_no/src_seq/客户
 */
import { readFileSync } from 'node:fs';
import { fetchAppToken, kingdeeGet } from '../../deploy/kingdee-client.mjs';

const API = 'http://localhost:8090/api';
const cfg = JSON.parse(readFileSync(new URL('../../deploy/config.json', import.meta.url), 'utf8'));
const k = cfg.kingdee || cfg;

// ① MES 侧:已转ERP的采购入库单(头表 ERP单号)
const lr = await fetch(API + '/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
});
const { data: { token: mesToken } } = await lr.json();
const qr = await fetch(API + '/px/queryFormDataList', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + mesToken },
  body: JSON.stringify({ panelCode: 'PURCHASE_IN', condition: {}, pageNo: 1, pageSize: 200 }),
});
const mes = ((await qr.json()).data?.list) || [];
const pushed = mes.filter((r) => String(r['ERP单号'] || '').trim());
console.log(`[MES] 采购入库单 ${mes.length} 张,其中已转ERP ${pushed.length} 张`);
for (const r of pushed) console.log(`   ${r['单据编号']} → ERP ${r['ERP单号']} | MES采购订单号=[${r['采购订单号'] || ''}]`);

// ② 金蝶侧:bydoc 取详情,核对来源单族
const { token } = await fetchAppToken(k);
const kd = [];
for (let page = 1; page <= 4; page++) {
  const l = await kingdeeGet(k, token, '/jdy/v2/scm/pur_inbound', { page: String(page), page_size: '50' });
  const rows = l.rows || [];
  kd.push(...rows);
  if (rows.length < 50) break;
}
console.log(`[金蝶] 抓取最近 ${kd.length} 张采购入库单`);
for (const r of pushed) {
  const hit = kd.find((x) => String(x.bill_no) === String(r['ERP单号']));
  if (!hit) { console.log(`   ${r['ERP单号']}:金蝶最近 ${kd.length} 张内未找到(可能更早)`); continue; }
  const d = await kingdeeGet(k, token, '/jdy/v2/scm/pur_inbound_detail', { id: hit.id });
  const lines = (d.material_entity || []).map((e) => ({
    商品: e.material_number, 数量: e.qty, 基本数量: e.base_qty,
    源单编号: e.src_bill_no || '(空)', 源单行号: e.src_seq ?? '(空)', 源单类型: e.src_bill_type_name || '(空)',
  }));
  console.log(`\n   ${d.bill_no} 状态=${d.bill_status} 供应商=${d.supplier_name} 客户=[${d.customer_name || ''}] 备注=${(d.remark || '').slice(0, 40)}`);
  for (const l of lines) console.log('      ', JSON.stringify(l));
}
