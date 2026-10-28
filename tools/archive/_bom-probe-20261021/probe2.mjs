/**
 * probe2.mjs — 深挖金蝶 BOM 为什么返回 0 行(2026-10-21)
 *
 * 上一轮:真实账套(tf.jdy.com,outerInstanceId 非空)下 /jdy/v2/bd/bom 返回 200 但 rows=0。
 * 要区分三种可能:
 *   ① 金蝶账套里**确实没建 BOM** → 数据问题,只能去金蝶补
 *   ② 接口需要**必须的筛选参数**(如 material_id)才返回 → 调用方式问题
 *   ③ 该接口在星辰/精斗云版本里**未开放** → 走 /jdy/v2/pm/bom 或其它
 *
 * 顺带确认:商品档案里有多少个「生产」类商品(有没有可建 BOM 的成品)。
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
console.log(`真实账套 domain=${domain}`);

function show(tag, data) {
  const rows = data.rows || data.bom_list || [];
  console.log(`\n[${tag}] count=${data.count ?? '?'} rows=${Array.isArray(rows) ? rows.length : '?'}`);
  if (Array.isArray(rows) && rows.length) {
    console.log('  首行键: ' + Object.keys(rows[0]).slice(0, 30).join(', '));
    console.log('  首行: ' + JSON.stringify(rows[0]).slice(0, 900));
  }
}

// ① 不带任何筛选,列全部(含已禁用 status=-1)
for (const q of [
  { tag: 'bom 默认', path: '/jdy/v2/bd/bom', p: { page: '1', page_size: '50' } },
  { tag: 'bom 含禁用 status=-1', path: '/jdy/v2/bd/bom', p: { page: '1', page_size: '50', status: '-1' } },
  { tag: 'bom un_page=1', path: '/jdy/v2/bd/bom', p: { un_page: '1', page_size: '50' } },
]) {
  try { show(q.tag, await kingdeeGet(cfg.kingdee, token, q.path, q.p)); }
  catch (e) { console.log(`\n[${q.tag}] FAIL ${String(e.message || e).slice(0, 200)}`); }
}

// ② 商品档案:看有没有成品(成品才有可能配 BOM)
try {
  const mat = await kingdeeGet(cfg.kingdee, token, '/jdy/v2/bd/material', { page: '1', page_size: '5' });
  show('商品档案首页', mat);
  console.log(`\n商品总数 count=${mat.count}`);
  const first = (mat.rows || [])[0];
  if (first) {
    // 用第一个商品试 bom_query 的 material_id 参数
    const mid = first.id;
    console.log(`\n用商品 ${first.number}(${mid}) 试 bom_query:`);
    for (const p of [
      { tag: 'bom_query material_id', path: '/jdy/v2/bd/bom_query', q: { material_id: String(mid), page: '1', page_size: '20' } },
      { tag: 'bom material_id', path: '/jdy/v2/bd/bom', q: { material_id: String(mid), page: '1', page_size: '20' } },
    ]) {
      try { show(p.tag, await kingdeeGet(cfg.kingdee, token, p.path, p.q)); }
      catch (e) { console.log(`\n[${p.tag}] FAIL ${String(e.message || e).slice(0, 200)}`); }
    }
  }
} catch (e) {
  console.log(`\n[商品档案] FAIL ${String(e.message || e).slice(0, 200)}`);
}
