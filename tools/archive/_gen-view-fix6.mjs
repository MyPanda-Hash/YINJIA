// _gen-view-fix6.mjs — 视图缺列修复(终版):panda 系 EXEC 单行原文动刀(首个行内 FROM 前插补列,保留原转义)
import fs from 'node:fs';

const bad = {
  DISPATCH_STATS: ['部门'], FINISH_IN_DETAIL: ['创建时间'], FINISH_IN_STATS: ['项目'],
  MANU_ORDER_STATS: ['产品编码'], MATERIAL_OUT_DETAIL: ['创建时间'], MATERIAL_OUT_STATS: ['仓库编码'],
  OTHER_IN_DETAIL: ['创建时间'], OTHER_IN_STATS: ['仓库编码'], OTHER_OUT_DETAIL: ['创建时间'], OTHER_OUT_STATS: ['仓库编码'],
  OUTSOURCE_IN_STATS: ['仓库'], OUTSOURCE_ISSUE_DETAIL: ['发料仓库'], OUTSOURCE_ISSUE_STATS: ['仓库'],
  PURCHASE_IN_STATS: ['仓库编码'], SALE_OUT_DETAIL: ['仓库编码'], SALE_OUT_STATS: ['单据日期（周）'],
  SALES_ORDER_DETAIL: ['存货'], SALES_ORDER_STATS: ['客户编码'],
};
const viewOf = Object.fromEntries(
  fs.readFileSync('tools/archive/_pv.out', 'utf8').split('\n')
    .filter(l => l.includes('|') && !l.startsWith('panel_code') && !l.startsWith('-'))
    .map(l => { const i = l.indexOf('|'); return [l.slice(0, i), l.slice(i + 1).trim()]; }));

const srcFiles = ['tools/migrate-panda-parity.sql', 'tools/migrate-panda-replica.sql', 'tools/migrate-status-align.sql'];
const allLines = srcFiles.flatMap(f => fs.readFileSync(f, 'utf8').split('\n').map(l => ({ f, l })));

let sql = `-- migrate-align-views-20260924.sql — 视图缺列兼容修复(2026-09-24 全面板扫描产物)
-- 背景:远程库对报表视图做过库上直改(补布局列)未入迁移链,本地旧版缺输出列 → 面板 500(Invalid column)。
-- 修法:panda 系 EXEC 单行原文动刀——首个行内 FROM 前插 NULL AS 补列(保原转义态);id 缺口(v_lot_trace)另由专项脚本管。
SET NOCOUNT ON;
`;
let fixed = 0; const skipped = [];
for (const [pc, cols] of Object.entries(bad)) {
  const v = viewOf[pc];
  if (!v) { skipped.push(pc); continue; }
  const addStr = ', ' + cols.map(c => `NULL AS [${c}]`).join(', ');
  // 找该视图 CREATE 行(多行 EXEC 块起点),向下收集到 ');' 结束行
  let start = -1;
  for (let i = allLines.length - 1; i >= 0; i--) {
    if (allLines[i].l.includes(`VIEW ${v} `) || allLines[i].l.includes(`VIEW ${v}(`)) { start = i; break; }
  }
  if (start < 0) { skipped.push(pc + '(无CREATE行)'); continue; }
  let end = start;
  while (end < allLines.length && !allLines[end].l.includes("');")) end++;
  const block = allLines.slice(start, end + 1).map(x => x.l);
  // 块内首个 FROM(行首或行内)——多行列清单形态:FROM 在独立行,其行首插补列(与上一列行尾逗号衔接)
  const fi = block.findIndex(x => /^FROM /i.test(x.trim()) || x.includes(' FROM '));
  if (fi < 0) { skipped.push(pc + '(块内无FROM)'); continue; }
  block[fi] = addStr + ' ' + block[fi];
  const src = block.join('\n');
  const srcFile = allLines[start].f.split('/').pop();
  sql += `\n-- ${pc} → ${v} (补: ${cols.join('/')}; 源: ${srcFile})\n${src}\nGO\n`;
  fixed++;
  console.log(`✓ ${v} ← ${srcFile}`);
}
sql += `\n-- ERPLG_ROW → erp_imp_row(实体表):补 asp_cancel\nIF OBJECT_ID('erp_imp_row') IS NOT NULL AND COL_LENGTH('erp_imp_row','asp_cancel') IS NULL ALTER TABLE erp_imp_row ADD [asp_cancel] char(1) NULL DEFAULT 'N';\nGO\n\nPRINT N'migrate-align-views-20260924 完成(${fixed}+ERPLG)';\n`;
fs.writeFileSync('tools/migrate-align-views-20260924.sql', sql, 'utf8');
console.log(`生成: ${fixed}` + (skipped.length ? ' | 跳过: ' + skipped.join(', ') : ''));
