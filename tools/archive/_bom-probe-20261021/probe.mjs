/**
 * probe.mjs — 实测金蝶 BOM 接口能否取到数据(2026-10-21)
 *
 * 目的:扫码领料要「按 BOM 展开工单该领哪些料」,但本地 bs_bom/v_wo_kit 已删、mate 只剩 1 个产品。
 * 用户选择「从金蝶拉 BOM 自动同步」,所以先证明**金蝶侧真有 BOM 且能取到**。
 *
 * 用法:node probe.mjs
 * 凭证复用 deploy/config.json(与正式同步同一套,只读,不写库)。
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
console.log(`app-token 就绪 (domain=${domain})`);

/** 依次试几个候选路径,谁通用谁 */
const CANDIDATES = [
  { name: 'BOM单列表 /jdy/v2/bd/bom', path: '/jdy/v2/bd/bom', q: { page: '1', page_size: '20' } },
  { name: 'BOM查询 /jdy/v2/bd/bom_query', path: '/jdy/v2/bd/bom_query', q: { page: '1', page_size: '20' } },
  { name: '按产品查BOM /jdy/v2/pm/bom', path: '/jdy/v2/pm/bom', q: { page: '1', page_size: '20' } },
];

for (const c of CANDIDATES) {
  try {
    const data = await kingdeeGet(cfg.kingdee, token, c.path, c.q);
    const rows = data.rows || data.bom_list || (Array.isArray(data) ? data : []);
    console.log(`\n[OK] ${c.name}`);
    console.log(`  返回字段: ${Object.keys(data).slice(0, 12).join(', ')}`);
    console.log(`  行数: ${Array.isArray(rows) ? rows.length : 'n/a'}`);
    if (Array.isArray(rows) && rows.length) {
      console.log(`  首行键: ${Object.keys(rows[0]).slice(0, 25).join(', ')}`);
      console.log(`  首行样例: ${JSON.stringify(rows[0]).slice(0, 600)}`);
    }
  } catch (e) {
    console.log(`\n[FAIL] ${c.name} → ${String(e.message || e).slice(0, 220)}`);
  }
}
