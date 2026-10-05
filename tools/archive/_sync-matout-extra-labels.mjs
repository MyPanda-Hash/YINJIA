// 一次性:把 kingdee-extra-fields.mjs 里 MATERIAL_OUT 的列名(c)同步成改名后的中文标签
//   (列名改了,映射表不同步 = 下载同步时写错列;本文件是生成器产物,这里按同名规则就地改)
import { readFileSync, writeFileSync } from 'node:fs';

const MAP = {
  '单据状态_bill_status': '金蝶单据状态',
  '审核时间_audit_time': '金蝶审核时间',
  '审核人_auditor_name': '金蝶审核人',
  'dept_id': '部门id',
  'creator_id': '创建人id',
  'modifier_id': '修改人id',
  'bill_type_id': '单据类型id',
  'auditor_id': '审核人id',
  'emp_id': '经手人id',
  'pick_use_id': '领料用途id',
};
const mod = await import(new URL('../../deploy/kingdee-extra-fields.mjs', import.meta.url).href + '?t=' + Date.now());
const EXTRA = { ...mod.EXTRA }, EXTRA_LINES = { ...mod.EXTRA_LINES };
let n = 0;
for (const section of [EXTRA, EXTRA_LINES]) {
  const list = section.MATERIAL_OUT;
  if (!Array.isArray(list)) continue;
  for (const e of list) if (MAP[e.c]) { console.log(`  ${e.c} → ${MAP[e.c]}  (接口键 ${e.a})`); e.c = MAP[e.c]; n++; }
}
console.log(`MATERIAL_OUT 映射条目改名: ${n} 条`);
writeFileSync(new URL('../../deploy/kingdee-extra-fields.mjs', import.meta.url), [
  '// kingdee-extra-fields.mjs — 全并集自动映射表(生成器产出,勿手改)',
  '//   EXTRA: 头/档案级 c=列 a=接口键(支持 dotted) t=dec/join/str',
  '//   EXTRA_LINES: 单据行级(键取自 material_entity 元素)',
  '//   注意:PURCHASE_IN/SALE_OUT/MATERIAL_OUT 的条目已备好但 sync-core 尚未接入(待同步脚本特殊要求)',
  `export const EXTRA = ${JSON.stringify(EXTRA, null, 2)};`,
  '',
  `export const EXTRA_LINES = ${JSON.stringify(EXTRA_LINES, null, 2)};`,
  '',
].join('\n'), 'utf8');
console.log('已写回 deploy/kingdee-extra-fields.mjs');
