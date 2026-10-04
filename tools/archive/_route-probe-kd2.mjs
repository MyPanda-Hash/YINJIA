// 探针:真实账套里与「生产/工艺路线」可能相关的既有接口,打印字段集与数据量
import { readFileSync } from 'node:fs';
import { fetchAppToken, kingdeeTryGet } from '../../deploy/kingdee-client.mjs';

const cfg = JSON.parse(readFileSync(new URL('../../deploy/config.json', import.meta.url), 'utf8'));
const PATHS = [
  ['生产任务单', '/jdy/v2/pm/mo_taskbill'],
  ['生产任务单详情', '/jdy/v2/pm/mo_taskbill_detail'],
  ['委外加工单', '/jdy/v2/pm/subm_workorder'],
  ['生产领料单', '/jdy/v2/pm/mat_issue_order'],
  ['产品入库单', '/jdy/v2/pm/subm_prodin'],
  ['BOM单', '/jdy/v2/bd/bom'],
  ['BOM单详情', '/jdy/v2/bd/bom_detail'],
  ['自定义字段定义', '/jdy/v2/sys/custom_field'],
  ['辅助属性', '/jdy/v2/bd/aux_info'],
];
const { token, domain } = await fetchAppToken(cfg.kingdee);
console.log(`授权 ✓ domain=${domain}\n`);
for (const [label, path] of PATHS) {
  const r = await kingdeeTryGet(cfg.kingdee, token, path, { page: '1', page_size: '1' });
  if (!r.ok) { console.log(`❌ ${label.padEnd(14)} ${path} → ${r.error}`); continue; }
  const d = r.data || {};
  const rows = d.rows || [];
  console.log(`✅ ${label.padEnd(14)} ${path} → count=${d.count ?? rows.length}`);
  if (rows[0]) {
    console.log(`   键(${Object.keys(rows[0]).length}): ${Object.keys(rows[0]).join(', ')}`);
    const arrKeys = Object.keys(rows[0]).filter((k) => Array.isArray(rows[0][k]));
    for (const k of arrKeys) {
      const e = rows[0][k][0];
      console.log(`   子表 ${k}[0] 键(${e ? Object.keys(e).length : 0}): ${e ? Object.keys(e).join(', ') : '空'}`);
    }
  }
  console.log('');
}
