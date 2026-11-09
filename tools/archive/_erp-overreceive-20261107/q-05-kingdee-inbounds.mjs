// 只读取证(1):金蝶真实账套里,YJ-20261027-05 已经被哪些采购入库单"入库"了(290 支从哪来)。
// 只发 GET;不写数据。运行: node tools/archive/_erp-overreceive-20261107/q-05-kingdee-inbounds.mjs
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchAppToken, kingdeeGet } from '../../../deploy/kingdee-client.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(readFileSync(resolve(here, '../../../deploy/config.json'), 'utf8')).kingdee;
const { token, domain } = await fetchAppToken(cfg);
cfg.domain = domain;

const PO = 'YJ-20261027-05';
const SUP = 'YJ-YCYX';
const rows = [];
for (let page = 1; page <= 40; page++) {
  const data = await kingdeeGet(cfg, token, '/jdy/v2/scm/pur_inbound', { page: String(page), page_size: '100' });
  const batch = data.rows || [];
  rows.push(...batch);
  if (page >= (data.total_page || 1) || batch.length === 0) break;
}
console.log('pur_inbound 共抓', rows.length, '张');

const cand = rows.filter((r) => r.supplier_number === SUP && String(r.bill_date) >= '2026-09-01');
console.log('其中供应商', SUP, '、单据日期>=2026-09-01:', cand.length, '张');

for (const r of cand) {
  let d;
  try {
    d = await kingdeeGet(cfg, token, '/jdy/v2/scm/pur_inbound_detail', { id: String(r.id) });
  } catch (e) {
    console.log('  detail fail', r.bill_no, e.message);
    continue;
  }
  const ents = d.material_entity || [];
  const mine = ents.filter((e) => e.src_bill_no === PO);
  if (mine.length === 0) continue;
  console.log('\n=== 命中来源单', PO, ':', r.bill_no, '日期', r.bill_date, '状态', r.bill_status, '备注', JSON.stringify(r.remark || ''));
  for (const e of mine) {
    console.log(JSON.stringify({
      seq: e.seq, material: e.material_number, qty: e.qty, base_qty: e.base_qty, unit: e.unit_name,
      src_bill_no: e.src_bill_no, src_seq: e.src_seq, batch_no: e.batch_no, comment: e.comment || '',
      src_bill_type_name: e.src_bill_type_name,
    }));
  }
}

// 另外把 2026-11 以来该供应商的入库单都列出来,便于对照 MES 单号
console.log('\n=== 该供应商 2026-11 起的入库单(头) ===');
for (const r of rows.filter((x) => x.supplier_number === SUP && String(x.bill_date) >= '2026-10-20').sort((a, b) => String(a.bill_date).localeCompare(String(b.bill_date)))) {
  console.log([r.bill_no, r.bill_date, r.bill_status, r.remark || '', r.total_amount].join(' | '));
}
