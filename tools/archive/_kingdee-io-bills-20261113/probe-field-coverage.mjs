// 探针⑦:逐单据「金蝶接口键数 vs MES 面板字段数」对照基线(只读,取真实账套最近一张单的详情)
// 用法: node tools/archive/_kingdee-io-bills-20261113/probe-field-coverage.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fetchAppToken, kingdeeTryGet } from '../../../deploy/kingdee-client.mjs';

const cfg = JSON.parse(readFileSync(new URL('../../../deploy/config.json', import.meta.url), 'utf8'));
const { token } = await fetchAppToken(cfg.kingdee);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const DOCS = [
  ['采购入库单', '/jdy/v2/scm/pur_inbound', '/jdy/v2/scm/pur_inbound_detail', 'PURCHASE_IN'],
  ['销售出库单', '/jdy/v2/scm/sal_out_bound', '/jdy/v2/scm/sal_out_bound_detail', 'SALE_OUT'],
  ['生产领料单', '/jdy/v2/scm/inv_pick', '/jdy/v2/scm/inv_pick_detail', 'MATERIAL_OUT'],
  ['产品入库单', '/jdy/v2/scm/inv_product', '/jdy/v2/scm/inv_product_detail', 'FINISH_IN'],
  ['其他入库单', '/jdy/v2/scm/inv_other_in', '/jdy/v2/scm/inv_other_in_detail', 'OTHER_IN'],
  ['其他出库单', '/jdy/v2/scm/inv_other_out', '/jdy/v2/scm/inv_other_out_detail', 'OTHER_OUT'],
  ['采购退货单', '/jdy/v2/scm/pur_ret', '/jdy/v2/scm/pur_ret_detail', 'QC_RETURN'],
];

const nonEmpty = (v) => v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0);
const out = [];

for (const [label, listPath, detailPath, panel] of DOCS) {
  const l = await kingdeeTryGet(cfg.kingdee, token, listPath, { page: '1', page_size: '5' });
  const bill = (l.data?.rows || [])[0];
  if (!bill) { console.log(`⚠ ${label} 无单据`, ); out.push({ label, panel, error: 'no bill' }); continue; }
  await sleep(120);
  const d = await kingdeeTryGet(cfg.kingdee, token, detailPath, { id: bill.id });
  if (!d.ok) { console.log(`❌ ${label} 详情失败 ${d.error}`); out.push({ label, panel, error: d.error }); continue; }
  const data = d.data || {};
  const head = Object.keys(data).filter((k) => k !== 'material_entity');
  const headFilled = head.filter((k) => nonEmpty(data[k]));
  const ents = data.material_entity || data.entries || [];
  const lineKeys = ents[0] ? Object.keys(ents[0]) : [];
  const lineFilled = ents[0] ? lineKeys.filter((k) => nonEmpty(ents[0][k])) : [];
  const row = {
    label, panel, bill_no: bill.bill_no, bill_date: bill.bill_date, status: bill.bill_status,
    headKeys: head.length, headFilled: headFilled.length,
    lineKeys: lineKeys.length, lineFilled: lineFilled.length, lineRows: ents.length,
  };
  console.log(`${label.padEnd(10)} ${bill.bill_no}  头键=${row.headKeys}(有值${row.headFilled})  行键=${row.lineKeys}(有值${row.lineFilled})  分录数=${row.lineRows}`);
  out.push(row);
  await sleep(120);
}
writeFileSync(new URL('./field-coverage.json', import.meta.url), JSON.stringify(out, null, 2), 'utf8');
