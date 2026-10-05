// 探针:金蝶云·星辰「工艺路线/工序」端点第二轮穷举(命名变体)
import { readFileSync } from 'node:fs';
import { fetchAppToken, kingdeeTryGet } from '../../deploy/kingdee-client.mjs';

const cfg = JSON.parse(readFileSync(new URL('../../deploy/config.json', import.meta.url), 'utf8'));
const NAMES = ['process_route', 'process_route_detail', 'process', 'process_detail', 'procedure', 'procedure_detail',
  'operation', 'operation_detail', 'routing', 'routing_detail', 'route', 'route_detail', 'route_bill',
  'craft', 'craft_route', 'craft_process', 'technics', 'technic', 'technic_route',
  'work_procedure', 'work_route', 'work_process', 'product_route', 'mo_route', 'process_flow',
  'process_info', 'procedure_info', 'work_center', 'workcenter', 'machine', 'equipment', 'team', 'shift'];
const PATHS = [];
for (const n of NAMES) { PATHS.push(['pm', `/jdy/v2/pm/${n}`]); PATHS.push(['bd', `/jdy/v2/bd/${n}`]); }

const { token } = await fetchAppToken(cfg.kingdee);
const hits = [];
for (const [ns, path] of PATHS) {
  const r = await kingdeeTryGet(cfg.kingdee, token, path, { page: '1', page_size: '1' });
  if (r.ok) {
    const d = r.data || {};
    hits.push({ path, count: d.count ?? (d.rows || []).length, keys: (d.rows || [])[0] ? Object.keys(d.rows[0]) : [] });
    console.log(`✅ ${path} → count=${d.count ?? (d.rows || []).length}`);
  }
}
console.log(`\n探测 ${PATHS.length} 条路径,可用 ${hits.length} 条`);
// 未命中的按错误类型归并统计
console.log(JSON.stringify(hits, null, 1));
