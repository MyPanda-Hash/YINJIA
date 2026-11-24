// 只读取证(真实账套 359797):扫近期采购入库单明细,找出谁挂了订单 YJ-20260924-04 / YJ-20261014-03
// 只发 GET。运行: node tools/archive/_erp-link-full-20261124/_q-scan-inbound.mjs [页数]
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchAppToken, kingdeeGet, kingdeeTryGet } from '../../../deploy/kingdee-client.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(readFileSync(resolve(here, '../../../deploy/config.json'), 'utf8').replace(/^\uFEFF/, '')).kingdee;
const { token, domain } = await fetchAppToken(cfg);
cfg.domain = domain;

const POS = ['YJ-20260924-04', 'YJ-20261014-03'];
const pages = Number(process.argv[2] || 3);
let scanned = 0, hits = 0;
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
      if (!POS.includes(src)) continue;
      hits++;
      console.log('★ ' + r.bill_no + ' | 单据日 ' + r.bill_date + ' | ' + r.bill_status
        + ' | 供应商=' + (r.supplier_name || '') + ' | 备注=' + (r.remark || '')
        + ' | seq=' + e.seq + ' ' + e.material_number + ' qty=' + e.qty
        + ' | src_seq=' + (e.src_seq || '') + ' | batch=' + (e.batch_no || '-')
        + ' | create=' + (r.create_time || ''));
    }
  }
  if (p >= Number(list.total_page || 1)) break;
}
console.log('\n扫描 ' + scanned + ' 张 | 命中 ' + POS.join('/') + ' 的行 ' + hits);
