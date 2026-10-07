// _verify-invpick-pushed.mjs — 回读「转ERP」推入金蝶的生产领料单,核对落库字段(只读)
// 用法: node tools/archive/_verify-invpick-pushed.mjs CL-2026-10-0001 [sandbox|real]
//   按 MES 单号在备注里找 [MES:<单号>](推送时 remark 追加该标记,金蝶不传 bill_no 自己编号)
import { readFileSync } from 'node:fs';
import { fetchAppToken, kingdeeTryGet } from '../../deploy/kingdee-client.mjs';

const mesNo = process.argv[2];
const which = process.argv[3] || 'sandbox';
const raw = JSON.parse(readFileSync(new URL(which === 'real' ? '../../deploy/config.json' : '../../deploy/push/config.json', import.meta.url), 'utf8'));
const cfg = which === 'real' ? raw.kingdee : { ...raw.kingdee, outerInstanceId: raw.kingdee.sandboxInstanceId || '579046204055359488' };
const { token } = await fetchAppToken(cfg);

const list = await kingdeeTryGet(cfg, token, '/jdy/v2/scm/inv_pick', { page: '1', page_size: '50' });
if (!list.ok) { console.log('❌ 列表失败', list.error); process.exit(1); }
const rows = list.data.rows || [];
console.log(`金蝶${which === 'real' ? '真实账套' : '测试沙箱'} 生产领料单 count=${list.data.count},本页 ${rows.length} 张`);
const hit = rows.find((r) => String(r.remark || '').includes(mesNo)) || rows[0];
console.log(`命中单据:${hit.bill_no}(remark=${hit.remark || ''})`);
const d = await kingdeeTryGet(cfg, token, '/jdy/v2/scm/inv_pick_detail', { id: hit.id });
if (!d.ok) { console.log('❌ 详情失败', d.error); process.exit(1); }
const data = d.data;
console.log('\n【头字段(非空)】');
for (const [k, v] of Object.entries(data)) {
  if (Array.isArray(v) || v === null || v === '' || v === undefined) continue;
  console.log(`  ${k} = ${typeof v === 'object' ? JSON.stringify(v) : v}`);
}
console.log('\n【material_entity 行】');
for (const e of (data.material_entity || [])) {
  const keep = Object.fromEntries(Object.entries(e).filter(([, v]) => v !== null && v !== '' && v !== 0 && v !== false));
  console.log('  ' + JSON.stringify(keep));
}
