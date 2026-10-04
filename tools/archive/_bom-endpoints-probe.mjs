// 探针:真实账套穷举「BOM」相关接口路径(生产管理·BOM维护 等)
import { readFileSync } from 'node:fs';
import { fetchAppToken, kingdeeTryGet } from '../../deploy/kingdee-client.mjs';

const cfg = JSON.parse(readFileSync(new URL('../../deploy/config.json', import.meta.url), 'utf8'));
const NAMES = ['bom', 'bom_detail', 'bom_list', 'bom_maintain', 'ebom', 'mbom', 'ebom_detail', 'mbom_detail',
  'product_bom', 'product_bom_detail', 'mo_bom', 'mo_bom_detail', 'pm_bom', 'pm_bom_detail', 'bom_entity',
  'material_bom', 'material_bom_detail', 'inv_bom', 'bom_bill', 'bom_bill_detail', 'bom_version',
  'simulatedbom', 'simulated_bom', 'sim_bom', 'bomgroup', 'bom_group', 'bom_route', 'routing_bom',
  'recipe', 'formula', 'formula_detail'];
const NS = ['bd', 'pm', 'scm', 'inv'];
const PATHS = [];
for (const n of NAMES) for (const ns of NS) PATHS.push(`/jdy/v2/${ns}/${n}`);

const { token, domain } = await fetchAppToken(cfg.kingdee);
console.log(`授权 ✓ domain=${domain};探测 ${PATHS.length} 条路径\n`);
const ok = [];
for (const path of PATHS) {
  const r = await kingdeeTryGet(cfg.kingdee, token, path, { page: '1', page_size: '5' });
  if (!r.ok) continue;
  const d = r.data || {};
  const rows = d.rows || [];
  ok.push({ path, count: d.count ?? rows.length, keys: rows[0] ? Object.keys(rows[0]) : [] });
  console.log(`✅ ${path} → count=${d.count ?? rows.length}${rows[0] ? ' 顶层键: ' + Object.keys(rows[0]).join(',') : ''}`);
}
console.log(`\n可用 ${ok.length} 条 / ${PATHS.length}`);
console.log(JSON.stringify(ok.filter((x) => Number(x.count) > 0), null, 1));
