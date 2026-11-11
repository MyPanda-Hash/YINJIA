// 只读取证(真实账套):谁把 YJ-KBL-002 在订单 YJ-20261103-01 上收满了
// 只发 GET。运行: node tools/archive/_erp-closed-segment-20261111/_q-who-filled.mjs
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchAppToken, kingdeeGet, kingdeeTryGet } from '../../../deploy/kingdee-client.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const rawCfg = readFileSync(resolve(here, '../../../deploy/config.json'), 'utf8').replace(/^\uFEFF/, '');
const cfg = JSON.parse(rawCfg).kingdee;
const { token, domain } = await fetchAppToken(cfg);
cfg.domain = domain;

const PO = 'YJ-20261103-01';
const SUP = '惠州市康佰利包装材料有限公司';

console.log('=== 最近 40 张采购入库单里 supplier=' + SUP + ' 的 ===');
const list = await kingdeeGet(cfg, token, '/jdy/v2/scm/pur_inbound', { page: '1', page_size: '40' });
const rows = (list.rows || []).filter((r) => String(r.supplier_name || r.supplier_number || '').includes('康佰利'));
for (const r of rows) {
  console.log([r.id, r.bill_no, r.bill_date, r.bill_status, r.io_status, r.create_time].join(' | '));
}

for (const r of rows) {
  const d = await kingdeeTryGet(cfg, token, '/jdy/v2/scm/pur_inbound_detail', { id: String(r.id) });
  if (!d.ok) { console.log(r.bill_no, '详情失败', d.error); continue; }
  const ents = d.data.material_entity || [];
  const hits = ents.filter((e) => String(e.material_number || '').startsWith('YJ-KBL'));
  if (!hits.length) continue;
  console.log('\n-- ' + r.bill_no + ' (' + r.bill_date + ', ' + r.bill_status + ') --');
  for (const e of hits) {
    console.log([
      'seq=' + e.seq, e.material_number, 'qty=' + e.qty,
      'src_bill_no=' + (e.src_bill_no || ''), 'src_seq=' + (e.src_seq || ''),
      'batch_no=' + (e.batch_no || ''), 'src_entry_id=' + (e.src_entry_id || ''),
    ].join(' | '));
  }
}

console.log('\n=== 金蝶里 YJ-KBL-002 的入库历史(按 src_bill_no 精确列) ===');
const chk = await kingdeeTryGet(cfg, token, '/jdy/v2/scm/pur_inbound', { page: '1', page_size: '20', src_bill_no: PO });
const ids = ((chk.data && chk.data.rows) || []).map((x) => x.bill_no);
console.log('该订单相关入库单(按 src_bill_no 过滤命中):', ids.join(', ') || '(无)');
