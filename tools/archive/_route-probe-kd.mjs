// 探针:金蝶云·星辰真实账套是否存在「工艺路线 / 工序」类接口
// 用法:node tools/archive/_route-probe-kd.mjs
// 说明:HTTP 519 = 无此接口(历史实测口径,见 tools/migrate-material-out-erp.sql 注释)
import { readFileSync } from 'node:fs';
import { fetchAppToken, kingdeeTryGet } from '../../deploy/kingdee-client.mjs';

const cfg = JSON.parse(readFileSync(new URL('../../deploy/config.json', import.meta.url), 'utf8'));
const CANDIDATES = [
  ['工艺路线', '/jdy/v2/pm/process_route'],
  ['工艺路线', '/jdy/v2/pm/process_route_detail'],
  ['工艺路线', '/jdy/v2/pm/route'],
  ['工艺路线', '/jdy/v2/pm/routing'],
  ['工艺路线', '/jdy/v2/pm/craft_route'],
  ['工艺路线', '/jdy/v2/pm/craft_process'],
  ['工艺路线', '/jdy/v2/bd/process_route'],
  ['工艺路线', '/jdy/v2/bd/routing'],
  ['工艺路线', '/jdy/v2/bd/route'],
  ['工艺路线', '/jdy/v2/bd/craft_route'],
  ['工序', '/jdy/v2/pm/process'],
  ['工序', '/jdy/v2/pm/process_detail'],
  ['工序', '/jdy/v2/pm/working_procedure'],
  ['工序', '/jdy/v2/bd/process'],
  ['工序', '/jdy/v2/bd/working_procedure'],
  ['生产任务单(对照,已知可用)', '/jdy/v2/pm/mo_taskbill'],
];

const { token, domain } = await fetchAppToken(cfg.kingdee);
console.log(`授权 ✓ domain=${domain}\n`);
for (const [label, path] of CANDIDATES) {
  const r = await kingdeeTryGet(cfg.kingdee, token, path, { page: '1', page_size: '1' });
  if (!r.ok) { console.log(`❌ ${label.padEnd(20)} ${path} → ${r.error}`); continue; }
  const d = r.data || {};
  const count = Number(d.count !== undefined ? d.count : (d.rows ? d.rows.length : '?'));
  const first = (d.rows || [])[0];
  console.log(`✅ ${label.padEnd(20)} ${path} → count=${count}`);
  if (first) console.log(`   键(${Object.keys(first).length}): ${Object.keys(first).join(', ')}`);
}
