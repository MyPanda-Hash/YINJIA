// 一次性:按 yj_field seq=950 反查的全并集补列(含新旧两轮)生成统一清理 SQL
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const TABLE = { SETTLE: 'bs_settle_type', CUSGRP: 'bs_customer_group', SUPGRP: 'bs_supplier_group', MATGRP: 'bs_material_group', CUR: 'bs_currency', UOM: 'bs_uom', DEPT: 'bs_dept', EMP: 'bs_emp', WH: 'bs_wh', INV: 'bs_inv', KHDA: 'dm_kh', GFDA: 'dm_gf', SO_ORDER: 'bd_so_order', PU_ORDER: 'bd_pu_order' };
const out = ['SET NOCOUNT ON'];
let n = 0;
for (const line of readFileSync(join(HERE, '_q6.out'), 'utf8').split(/\r?\n/)) {
  const [p, c] = line.split('|');
  if (!p || !c || p === 'panel_code' || !TABLE[p]) continue;
  n++;
  out.push(`IF COL_LENGTH('dbo.${TABLE[p]}', N'${c}') IS NOT NULL ALTER TABLE dbo.${TABLE[p]} DROP COLUMN [${c}];`);
  out.push(`DELETE FROM yj_field WHERE panel_code='${p}' AND col_name=N'${c}';`);
  out.push(`DELETE FROM yj_translation WHERE scope='field' AND ref_key=N'${c}';`);
}
out.push("PRINT N'补列清理完成'");
writeFileSync(join(HERE, '_drop-extra-cols.sql'), out.join('\n') + '\n', 'utf8');
console.log('清理列数:', n);
