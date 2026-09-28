// _gen-view-fix3.mjs — 视图缺列修复(第三版):每个 SELECT 段(行首 FROM 之前)尾部追加 NULL AS [缺列]
// UNION 视图每段同位尾加 → 按位对齐;单段视图同样适用。生成 migrate-align-views-20260924.sql
import { execSync } from 'node:child_process';
import fs from 'node:fs';

const bad = {
  DISPATCH_STATS: ['部门'], FINISH_IN_DETAIL: ['创建时间'], FINISH_IN_STATS: ['项目'],
  LOT_TRACE: ['id'], MANU_ORDER_STATS: ['产品编码'], MATERIAL_OUT_DETAIL: ['创建时间'], MATERIAL_OUT_STATS: ['仓库编码'],
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
-- 背景:远程库对 *_DETAIL/*_STATS 报表视图做过库上直改(补布局列)未入迁移链,本地旧版缺输出列 → 面板 500(Invalid column)。
-- 修法:每个 SELECT 段列尾追加 NULL AS [缺列](UNION 各段同位尾加,按位对齐;id 列用 ROW_NUMBER 实数)。
SET NOCOUNT ON;
`;
let fixed = 0, skipped = [];
for (const [pc, cols] of Object.entries(bad)) {
  const v = viewOf[pc];
  if (!v) { skipped.push(pc + '(无视图)'); continue; }
  fs.writeFileSync('tools/archive/_vd.sql', `SET NOCOUNT ON\nSELECT CONVERT(nvarchar(max), definition) FROM sys.sql_modules WHERE object_id=OBJECT_ID('${v}')\n`, 'utf8');
  execSync('docker cp tools/archive/_vd.sql mssql2019:/tmp/vd.sql', { shell: true, stdio: 'ignore' });
  const out = execSync('docker exec mssql2019 bash -c "/opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P Yinjia@2026 -C -d HSDZ_MES -f 65001 -I -y 0 -i /tmp/vd.sql"', { shell: true, encoding: 'utf8', maxBuffer: 1e8, stdio: ['ignore', 'pipe', 'ignore'] });
  const lines = out.split('\n');
  const bi = lines.findIndex(l => l.trim().length > 40 && /^-+$/.test(l.trim()));
  let d = lines.slice(bi + 1).join('\n').replace(/\r/g, '').replace(/\n+$/, '').trim();
  if (!/^CREATE VIEW/.test(d)) { skipped.push(pc + '(定义提取失败)'); continue; }
  // 每个 SELECT 段(行首 FROM 前)尾加缺列
  const add = [];
  for (const c of cols) add.push(c === 'id' ? 'ROW_NUMBER() OVER(ORDER BY (SELECT NULL)) AS id' : `NULL AS [${c}]`);
  const addStr = ', ' + add.join(', ');
  const dlines = d.split('\n');
  for (let i = 0; i < dlines.length; i++) {
    if (/^FROM /.test(dlines[i].trim()) || /^FROM\t/.test(dlines[i])) {
      // 该 SELECT 段最后一列在上一非空行行尾
      let k = i - 1;
      while (k >= 0 && dlines[k].trim() === '') k--;
      if (k >= 0) dlines[k] = dlines[k].replace(/\s*$/, '') + addStr;
    }
  }
  d = dlines.join('\n').replace(/^CREATE VIEW/, 'CREATE OR ALTER VIEW');
  sql += `\n-- ${pc} → ${v} (补输出列: ${cols.join('/')})\nEXEC(N'${d.replace(/'/g, "''")}');\n`;
  fixed++;
  console.log(`✓ ${v} +${cols.join(',')}`);
}
sql += `\nPRINT N'migrate-align-views-20260924 完成(${fixed})';\n`;
fs.writeFileSync('tools/migrate-align-views-20260924.sql', sql, 'utf8');
console.log(`生成: ${fixed} 个视图` + (skipped.length ? ' | 跳过: ' + skipped.join(', ') : ''));
