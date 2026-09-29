/* _reg-lineno-migration.cjs — 一次性:把 migrate-material-out-line-no.sql 追加进 tools/db-migrations.txt
 * (LF 文件,node utf8 读写保字节;幂等:清单已含该脚本名则跳过)。 */
'use strict';
const fs = require('fs');
const path = require('path');
const list = path.resolve(__dirname, '../db-migrations.txt');
const SCRIPT = 'migrate-material-out-line-no.sql';
let text = fs.readFileSync(list, 'utf8');
if (new RegExp('^' + SCRIPT + '\\s*$', 'm').test(text)) {
  console.log('已登记,跳过');
  process.exit(0);
}
const lines = [
  '# —— 2026-10-14 材料出库单(领料)明细行加行号(参考销售订单 bl_so_order.行号 同口径:int 列+MS_Description+存量按单据编号分组回填 1..N+yj_field 注册 MATERIAL_OUT 明细首列 seq5 只读;译名 field/行号 9 语言全局存量不重插) —— migrate-material-out-line-no.sql',
  SCRIPT,
];
if (!text.endsWith('\n')) text += '\n';
if (!text.endsWith('\n\n')) text += '\n';
text += lines.join('\n') + '\n';
fs.writeFileSync(list, text, 'utf8');
console.log('已追加: ' + SCRIPT);
