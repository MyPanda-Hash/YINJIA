// 只读取证(真实账套):扫描近期采购入库单明细,找出哪些单挂了订单 YJ-20261103-01 / 收了 YJ-KBL-002
// 只发 GET。运行: node tools/archive/_erp-closed-segment-20261111/_q-scan-inbound.mjs [页数]
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchAppToken, kingdeeGet, kingdeeTryGet } from '../../../deploy/kingdee-client.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(readFileSync(resolve(here, '../../../deploy/config.json'), 'utf8').replace(/^\uFEFF/, '')).kingdee;
const { token, domain } = await fetchAppToken(cfg);
cfg.domain = domain;

const PO = 'YJ-20261103-01';
const pages = Number(process.argv[2] || 3);
let scanned = 0, hitSrc = 0, hitMat = 0;

for (let p = 1; p <= pages; p++) {
  const list = await kingdeeGet(cfg, token, '/jdy/v2/scm/pur_inbound', { page: String(p), page_size: '100' });
  const rows = list.rows || [];
  console.log('[page ' + p + '] ' + rows.length + ' 张  首单 ' + (rows[0] && rows[0].bill_no) + '  末单 ' + (rows.at(-1) && rows.at(-1).bill_no));
  for (const r of rows) {
    scanned++;
    const d = await kingdeeTryGet(cfg, token, '/jdy/v2/scm/pur_inbound_detail', { id: String(r.id) });
    if (!d.ok) continue;
    for (const e of d.data.material_entity || []) {
      const src = String(e.src_bill_no || '');
      const mat = String(e.material_number || '');
      if (src === PO) {
        hitSrc++;
        console.log('★挂本订单: ' + r.bill_no + ' | ' + r.bill_date + ' | ' + r.bill_status + ' | seq=' + e.seq
          + ' | ' + mat + ' qty=' + e.qty + ' | src_seq=' + (e.src_seq || '') + ' | batch=' + (e.batch_no || ''));
      }
      if (mat === 'YJ-KBL-002') {
        hitMat++;
        console.log('◇YJ-KBL-002: ' + r.bill_no + ' | ' + r.bill_date + ' | ' + r.bill_status + ' | qty=' + e.qty
          + ' | src_bill_no=' + (src || '-') + ' src_seq=' + (e.src_seq || '-') + ' | batch=' + (e.batch_no || '-')
          + ' | create=' + (r.create_time || ''));
      }
    }
  }
}
console.log('\n扫描 ' + scanned + ' 张 | 挂 ' + PO + ' 的行 ' + hitSrc + ' | YJ-KBL-002 的行 ' + hitMat);
