/**
 * probe5.mjs — 领料单分录的 src_bill_no 是否指向生产任务单(2026-10-21)
 *
 * 决定「BOM 缺失时能否自动反推配方」的最后一步:
 * 若分录的 src_bill_no 能定位到生产任务单(带产品编码+数量),就能算出单位用量;
 * 若 src_bill_no 为空或指向别的东西,自动反推不成立。
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

// 扫最近 30 张领料单,统计分录里 src_bill_no / src_bill_type_name 的填充情况
const list = await kingdeeGet(cfg.kingdee, token, '/jdy/v2/scm/inv_pick', { page: '1', page_size: '30' });
let total = 0, hasSrc = 0;
const typeNames = new Map();
const srcSamples = [];

for (const r of list.rows || []) {
  let d;
  try { d = await kingdeeGet(cfg.kingdee, token, '/jdy/v2/scm/inv_pick_detail', { id: String(r.id) }); }
  catch { continue; }
  for (const e of d.material_entity || []) {
    total++;
    const s = String(e.src_bill_no || '').trim();
    const t = String(e.src_bill_type_name || '').trim();
    if (t) typeNames.set(t, (typeNames.get(t) || 0) + 1);
    if (s) {
      hasSrc++;
      if (srcSamples.length < 5) srcSamples.push(`${s} [${t}] ${e.material_number} qty=${e.qty}`);
    }
  }
}

console.log(`扫 ${list.rows.length} 张领料单,分录 ${total} 行`);
console.log(`带 src_bill_no 的: ${hasSrc} 行 (${total ? Math.round(hasSrc * 100 / total) : 0}%)`);
console.log(`src_bill_type_name 分布: ${[...typeNames].map(([k, v]) => `${k}=${v}`).join(', ') || '(全空)'}`);
if (srcSamples.length) {
  console.log('样例:');
  for (const s of srcSamples) console.log('  ' + s);
}

// 若有源单号,试试能不能按它查生产任务单
if (srcSamples.length) {
  const srcNo = srcSamples[0].split(' ')[0];
  for (const p of ['/jdy/v2/scm/mo_task_bill', '/jdy/v2/scm/mo_task', '/jdy/v2/scm/inv_pick']) {
    try {
      const d = await kingdeeGet(cfg.kingdee, token, p, { page: '1', page_size: '5', search: srcNo });
      console.log(`\n[按源单号 ${srcNo} 查 ${p}] count=${d.count}`);
    } catch (e) {
      console.log(`\n[按源单号 ${srcNo} 查 ${p}] FAIL ${String(e.message || e).slice(0, 120)}`);
    }
  }
}
