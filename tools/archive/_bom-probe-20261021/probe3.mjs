/**
 * probe3.mjs — BOM 全空时的替代料源验证(2026-10-21)
 *
 * 已证实:真实账套 3878 个商品,但 /jdy/v2/bd/bom 与 bom_query 均 count=0
 *   → 金蝶账套里**没建 BOM**(不是权限/参数问题:同 token 查商品正常)。
 *
 * 那么「工单要领哪些料」还能从哪来?逐条验证:
 *   ① 生产任务单 mo_task_bill —— 若金蝶生产任务单自带子件用料
 *   ② 生产领料单 inv_pick_bill —— 历史实际领料,可按产品反推配方
 *   ③ 商品档案 bomentity 字段 —— 部分版本挂在商品详情里
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchAppToken, kingdeeGet } from '../../../deploy/kingdee-client.mjs';
import { setSecret } from '../../../deploy/kingdee-crypto.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(readFileSync(join(HERE, '../../../deploy/config.json'), 'utf8'));
setSecret(cfg.kingdee && cfg.kingdee.clientSecret);
const { token, domain } = await fetchAppToken(cfg.kingdee);
console.log(`真实账套 domain=${domain}\n`);

async function tryIt(tag, path, q) {
  try {
    const d = await kingdeeGet(cfg.kingdee, token, path, q);
    const rows = d.rows || [];
    console.log(`[${tag}] count=${d.count ?? '?'} rows=${rows.length}`);
    if (rows.length) {
      console.log('  键: ' + Object.keys(rows[0]).slice(0, 40).join(', '));
      console.log('  样: ' + JSON.stringify(rows[0]).slice(0, 700));
    }
    return d;
  } catch (e) {
    console.log(`[${tag}] FAIL ${String(e.message || e).slice(0, 180)}`);
    return null;
  }
}

// ① 生产任务单
await tryIt('生产任务单 mo_task_bill', '/jdy/v2/scm/mo_task_bill', { page: '1', page_size: '10' });
await tryIt('生产任务单 scm/mo_task', '/jdy/v2/scm/mo_task', { page: '1', page_size: '10' });

// ② 生产领料单(历史实际领料)
await tryIt('生产领料单 inv_pick_bill', '/jdy/v2/scm/inv_pick_bill', { page: '1', page_size: '10' });
await tryIt('生产领料单 inv_pick', '/jdy/v2/scm/inv_pick', { page: '1', page_size: '10' });

// ③ 商品详情里的 bomentity
const mat = await kingdeeGet(cfg.kingdee, token, '/jdy/v2/bd/material', { page: '1', page_size: '1' });
const mid = (mat.rows || [])[0]?.id;
if (mid) {
  try {
    const d = await kingdeeGet(cfg.kingdee, token, '/jdy/v2/bd/material_detail', { id: String(mid) });
    const keys = Object.keys(d);
    console.log(`\n[商品详情] 顶层键: ${keys.join(', ')}`);
    console.log(`  bomentity: ${JSON.stringify(d.bomentity ?? d.bom_entity ?? '不存在').slice(0, 400)}`);
  } catch (e) {
    console.log(`\n[商品详情] FAIL ${String(e.message || e).slice(0, 180)}`);
  }
}
