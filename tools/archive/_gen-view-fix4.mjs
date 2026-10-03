// _gen-view-fix4.mjs — 视图缺列修复(第四版:包裹法)——CREATE OR ALTER VIEW v AS SELECT t.*, NULL AS [缺列] FROM (原体) t
// 兼容一切内部形态(UNION/子查询/单行/多行);原定义去头(CREATE...AS)取体。
import { execSync } from 'node:child_process';
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

let sql = `-- migrate-align-views-20260924.sql — 视图缺列兼容修复(2026-09-24 全面板扫描产物)
-- 背景:远程库对报表视图做过库上直改(补布局列)未入迁移链,本地旧版缺输出列 → 面板 500(Invalid column)。
-- 修法:包裹法——原定义整体作派生表,外层 SELECT t.*, NULL AS [缺列];不依赖内部形态(UNION/子查询均兼容)。
-- 注:MANU_ORDER_STATS 产品编码本可 JOIN 行表,统一包裹保一致;id 缺口(v_lot_trace)已在 v3 版单独修复。
SET NOCOUNT ON;
`;
let fixed = 0, skipped = [];
for (const [pc, cols] of Object.entries(bad)) {
  const v = viewOf[pc];
  if (!v) { skipped.push(pc); continue; }
  fs.writeFileSync('tools/archive/_vd.sql', `SET NOCOUNT ON\nSELECT CONVERT(nvarchar(max), definition) FROM sys.sql_modules WHERE object_id=OBJECT_ID('${v}')\n`, 'utf8');
  execSync('docker cp tools/archive/_vd.sql mssql2019:/tmp/vd.sql', { shell: true, stdio: 'ignore' });
  const out = execSync('docker exec mssql2019 bash -c "/opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P Yinjia@2026 -C -d HSDZ_MES -f 65001 -I -y 0 -i /tmp/vd.sql"', { shell: true, encoding: 'utf8', maxBuffer: 1e8, stdio: ['ignore', 'pipe', 'ignore'] });
  const lines = out.split('\n');
  const bi = lines.findIndex(l => /^-+$/.test(l.trim()) && l.trim().length > 20);
  let d = lines.slice(bi + 1).join('\n').replace(/\r/g, '').replace(/\n+$/, '').trim();
  const m = d.match(/^CREATE\s+VIEW\s+\S+\s+AS\s+([\s\S]+)$/i);
  if (!m) { skipped.push(pc + '(头不匹配:' + d.slice(0, 40) + ')'); continue; }
  const body0 = m[1].trim().replace(/;$/, '');
  let tail = '';
  let body = body0;
  const om = body.match(/(?<!\()\s*?(ORDER\s+BY[\s\S]+)$/i);  // 负回顾:OVER(ORDER BY 不当尾巴
  if (om) { tail = ' ' + om[1].trim().replace(/;$/, '').replace(/(h|l|s|t|d)\.\[/g, '['); body = body.slice(0, om.index).trim().replace(/;$/, ''); }
  const adds = cols.map(c => `NULL AS [${c}]`).join(', ');
  let nd;
  if (/UNION/i.test(body)) {
    // UNION 视图(内部可能重名列,派生表不许)→ 包裹法;重名风险时 STATS 均带 AS 唯一名
    nd = `CREATE OR ALTER VIEW ${v} AS SELECT t.*, ${adds} FROM (${body}) t${tail}`;
  } else {
    // 单段视图 → 首个 FROM(行内或行首)之前插入补列
    const fi = body.search(/\sFROM\s/i);
    if (fi < 0) { skipped.push(pc + '(无 FROM)'); continue; }
    nd = `CREATE OR ALTER VIEW ${v} AS ${body.slice(0, fi)}, ${adds}${body.slice(fi)}${tail}`;
  }
  sql += `\n-- ${pc} → ${v} (补输出列: ${cols.join('/')})\nEXEC(N'${nd.replace(/'/g, "''")}');\n`;
  fixed++;
  console.log(`✓ ${v} +${cols.join(',')}`);
}
sql += `\n-- ERPLG_ROW → erp_imp_row(实体表非视图):补 asp_cancel 列\nIF OBJECT_ID('erp_imp_row') IS NOT NULL AND COL_LENGTH('erp_imp_row','asp_cancel') IS NULL ALTER TABLE erp_imp_row ADD [asp_cancel] char(1) NULL DEFAULT 'N';\nGO\n\nPRINT N'migrate-align-views-20260924 完成(${fixed}+ERPLG)';\n`;
fs.writeFileSync('tools/migrate-align-views-20260924.sql', sql, 'utf8');
console.log(`生成: ${fixed}` + (skipped.length ? ' | 跳过: ' + skipped.join(', ') : ''));
