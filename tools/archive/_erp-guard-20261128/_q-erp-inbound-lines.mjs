/**
 * 只读探针(2026-11-28):MES 推上去的采购入库单在金蝶侧落成了什么 ——
 *   ① 行上的 `batch_no` 是 MES 的「批次号」还是空/PC0000(验证批次号推送);
 *   ② `src_seq` / `src_entry_id` 有没有落到**具体订单分录**(验证订单行号挂联)。
 *
 * 用法(仓库根目录):
 *   node tools/archive/_erp-guard-20261128/_q-erp-inbound-lines.mjs sandbox CGRK-20261128-00050
 *   node tools/archive/_erp-guard-20261128/_q-erp-inbound-lines.mjs prod    CGRK-20260922-00038
 * 只发 GET。注意:本机「转ERP」目标账套 = 测试沙箱(application.yml allowProd=false),
 *       所以 MES 推的单据一般只能在 sandbox 里查到。
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchAppToken, kingdeeGet } from '../../../deploy/kingdee-client.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const which = (process.argv[2] || 'sandbox').toLowerCase();
const raw = which === 'prod'
  ? JSON.parse(readFileSync(resolve(root, 'deploy/config.json'), 'utf8').replace(/^\uFEFF/, '')).kingdee
  : JSON.parse(readFileSync(resolve(root, 'deploy/push/config.json'), 'utf8').replace(/^\uFEFF/, '')).kingdee;
const cfg = which === 'prod' ? raw : { ...raw, outerInstanceId: raw.sandboxInstanceId };
const tk = await fetchAppToken(cfg);
if (tk.domain) cfg.domain = tk.domain;
const n = (v) => (v === undefined || v === null ? '' : String(v));

for (const no of process.argv.slice(3)) {
  console.log(`\n##### 金蝶采购入库单 ${no} #####`);
  let head = null;
  try {
    const d = await kingdeeGet(cfg, tk.token, '/jdy/v2/scm/pur_inbound', { bill_no: no, page: '1', page_size: '20' });
    const rows = d.rows || [];
    head = rows.find((r) => n(r.bill_no) === no) || null;
    console.log(`[列表] 命中 ${rows.length}; 精确=${head ? '是' : '否'}; 供应商=${n(head && head.supplier_name)}`
      + ` 状态=${n(head && head.bill_status)} 备注=${n(head && head.remark)}`);
  } catch (e) { console.log('[列表] 失败:', e.message); continue; }
  if (!head) continue;
  try {
    const d = await kingdeeGet(cfg, tk.token, '/jdy/v2/scm/pur_inbound_detail', { id: head.id });
    for (const e of d.material_entity || []) {
      console.log(`  seq=${n(e.seq)} ${n(e.material_number)} qty=${n(e.qty)} 仓库=${n(e.stock_number)}`
        + ` 批号(batch_no)=${n(e.batch_no) || '(空)'}`
        + ` 源单=${n(e.src_bill_no) || '-'} src_seq=${n(e.src_seq) || '-'} src_entry_id=${n(e.src_entry_id) || '-'}`);
    }
  } catch (e) { console.log('[明细] 失败:', e.message); }
}
