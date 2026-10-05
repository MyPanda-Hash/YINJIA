// 探针:POST /jdy/v2/pm/bom_material(材料分录联动查询)—— 完整响应 + 多产品试,判断它能否当"生产BOM"数据源
import { readFileSync } from 'node:fs';
import { fetchAppToken, kingdeeTryGet, kingdeePost } from '../../deploy/kingdee-client.mjs';

const cfg = JSON.parse(readFileSync(new URL('../../deploy/config.json', import.meta.url), 'utf8'));
const { token } = await fetchAppToken(cfg.kingdee);

// 取几个真实商品(含成品/滤芯类)
const list = await kingdeeTryGet(cfg.kingdee, token, '/jdy/v2/bd/material', { page: '1', page_size: '200' });
const rows = (list.data?.rows || []);
const picks = rows.filter((r) => /滤芯|成品|总成|棒/.test(String(r.name || ''))).slice(0, 6);
console.log(`商品 ${rows.length} 条,挑 ${picks.length} 个疑似成品来查材料分录\n`);

for (const m of picks) {
  const r = await kingdeePost(cfg.kingdee, token, '/jdy/v2/pm/bom_material', {}, {
    bill_type: 'mo_task_bill',
    material_entity: [{ material_id: String(m.id), qty: 1, unit_id: '', plan_commit_date: '2026-10-04', plan_finish_date: '2026-10-05' }],
  });
  if (!r.ok) { console.log(`❌ ${m.number} ${m.name} → ${r.error}`); continue; }
  const d = r.data || {};
  const rs = d.rows || [];
  console.log(`✅ ${m.number} | ${m.name} | id=${m.id} → rows=${rs.length}`);
  if (rs.length) {
    console.log('   首行全字段:', JSON.stringify(rs[0]));
    if (rs.length > 1) console.log('   第2行:', JSON.stringify(rs[1]).slice(0, 400));
  } else {
    console.log('   原始返回:', JSON.stringify(d).slice(0, 300));
  }
  console.log('');
}
