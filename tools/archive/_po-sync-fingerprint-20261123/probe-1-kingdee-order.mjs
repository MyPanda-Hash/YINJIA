// 只读:直接问金蝶 YJ-20261117-01 现在是什么样(列表 + 详情),看修改时间与分录
import { readFileSync } from 'node:fs';
const cfg = JSON.parse(readFileSync(new URL('../../../deploy/config.json', import.meta.url), 'utf8'));
const { fetchAppToken, kingdeeGet } = await import('../../../deploy/kingdee-client.mjs');
const billNo = process.argv[2] || 'YJ-20261117-01';
const { token, domain } = await fetchAppToken(cfg.kingdee);
console.log('token ok, domain=', domain);

// ① 列表(不带状态过滤)
const list = await kingdeeGet(cfg.kingdee, token, '/jdy/v2/scm/pur_order', {
  bill_no: billNo, page: '1', page_size: '20',
});
console.log('\n== 列表命中', list?.count, '条 ==');
for (const r of (list?.rows || list?.list || [])) {
  const pick = {
    bill_no: r.bill_no, bill_date: r.bill_date, bill_status: r.bill_status,
    close_state: r.bill_close_state, supplier: r.supplier_name,
    modify_time: r.modify_time, create_time: r.create_time,
    auditor: r.auditor_name, audit_time: r.audit_time, id: r.id,
  };
  console.log(JSON.stringify(pick));
}
const headId = (list?.rows || list?.list || [])[0]?.id;

// ② 详情
const params = headId ? { id: String(headId) } : { bill_no: billNo };
const det = await kingdeeGet(cfg.kingdee, token, '/jdy/v2/scm/pur_order_detail', { ...params, page: '1', page_size: '100' });
const d = (det?.rows && det.rows[0]) || det || {};
console.log('\n== 详情头 ==', JSON.stringify({
  bill_no: d.bill_no, bill_status: d.bill_status, modify_time: d.modify_time,
  create_time: d.create_time, auditor_name: d.auditor_name, audit_time: d.audit_time,
}));
console.log('== 分录 ==');
for (const m of (d.material_entity || [])) {
  console.log(JSON.stringify({ seq: m.seq, material_number: m.material_number, material_name: m.material_name,
    qty: m.qty, base_qty: m.base_qty, price: m.price, amount: m.amount, unit: m.unit_name, comment: m.comment }));
}
console.log('== 分录条数 ==', (d.material_entity || []).length);
console.log('\n原始详情键(前 40):', Object.keys(d).slice(0, 40).join(', '));

