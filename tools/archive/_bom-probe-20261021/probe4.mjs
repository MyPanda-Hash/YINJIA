/**
 * probe4.mjs — 金蝶生产领料单能否反推「产品→用料」(2026-10-21)
 *
 * 已证实:BOM 接口 count=0(金蝶没建 BOM),但生产领料单有 **5053 张**。
 * 若领料单明细里带「产品/工单 + 材料 + 数量」,就能从历史实际领料**反推配方**,
 * 这是 BOM 缺失时唯一可自动化的料源。
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchAppToken, kingdeeGet } from '../../../deploy/kingdee-client.mjs';
import { setSecret } from '../../../deploy/kingdee-crypto.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(readFileSync(join(HERE, '../../../deploy/config.json'), 'utf8'));
setSecret(cfg.kingdee && cfg.kingdee.clientSecret);
const { token } = await fetchAppToken(cfg.kingdee);

// 取最近 3 张领料单,看详情结构
const list = await kingdeeGet(cfg.kingdee, token, '/jdy/v2/scm/inv_pick', { page: '1', page_size: '3' });
console.log(`领料单总数 count=${list.count}\n`);

for (const r of list.rows || []) {
  console.log(`=== ${r.bill_no} (${r.bill_date}) id=${r.id} ===`);
  try {
    const d = await kingdeeGet(cfg.kingdee, token, '/jdy/v2/scm/inv_pick_detail', { id: String(r.id) });
    console.log('  顶层键: ' + Object.keys(d).join(', '));
    const ents = d.material_entity || d.entry_list || [];
    console.log(`  分录数: ${ents.length}`);
    if (ents.length) {
      console.log('  分录键: ' + Object.keys(ents[0]).join(', '));
      for (const e of ents.slice(0, 4)) {
        console.log(`    ${e.material_number || e.materialid_number || '?'} ${e.material_name || e.materialid_name || ''} qty=${e.qty ?? e.actual_qty ?? '?'}`);
      }
    }
    // 关键:有没有工单号/产品信息
    const woKeys = Object.keys(d).filter((k) => /task|mo_|order|product|src|bill/i.test(k));
    console.log(`  单据级关联字段: ${woKeys.map((k) => `${k}=${JSON.stringify(d[k]).slice(0, 60)}`).join(' | ')}`);
  } catch (e) {
    console.log(`  详情 FAIL ${String(e.message || e).slice(0, 200)}`);
  }
  console.log();
}
