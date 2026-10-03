// _gen-view-fix2.mjs — 逐视图拉定义,缺列引用改 NULL AS / GROUP BY 移除,生成对齐迁移(第二段:写 SQL)
import { execSync } from 'node:child_process';
import fs from 'node:fs';

const bad = {
  DISPATCH_STATS: ['部门'], ERPLG_ROW: ['asp_cancel'], FINISH_IN_DETAIL: ['创建时间'], FINISH_IN_STATS: ['项目'],
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

const jobs = [];
for (const [pc, cols] of Object.entries(bad)) {
  const v = viewOf[pc];
  if (!v) { console.log('SKIP ' + pc); continue; }
  jobs.push({ pc, v, cols });
}
console.log('jobs=' + jobs.length);

// 逐视图拉定义
const defs = {};
for (const j of jobs) {
  fs.writeFileSync('tools/archive/_vd.sql', `SET NOCOUNT ON\nSELECT CONVERT(nvarchar(max), definition) FROM sys.sql_modules WHERE object_id=OBJECT_ID('${j.v}')\n`, 'utf8');
  execSync('docker cp tools/archive/_vd.sql mssql2019:/tmp/vd.sql', { shell: true });
  const out = execSync('docker exec mssql2019 bash -c "/opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P Yinjia@2026 -C -d HSDZ_MES -f 65001 -I -y 0 -i /tmp/vd.sql"', { shell: true, encoding: 'utf8', maxBuffer: 1e8, stdio: ['ignore', 'pipe', 'ignore'] });
  // 输出:两行头+定义(多行)+尾空行
  const lines = out.split('\n');
  const bi = lines.findIndex(l => l.trim() === '----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------') ;
  let def = lines.slice(bi + 1).join('\n').replace(/\r/g, '').replace(/\n+$/, '');
  defs[j.v] = def;
}

// 生成修复 SQL
let sql = `-- migrate-align-views-20260924.sql — 视图缺列兼容修复(2026-09-24 全面板扫描产物:${jobs.length} 个视图)
-- 背景:远程库对 *_DETAIL/*_STATS 视图做过库上直改(布局列 NULL AS)未入迁移链,本地旧版真列引用 → 面板 500。
-- 修法:缺列的 SELECT 引用改 NULL AS(远程同款布局列语义);GROUP BY 里的同列引用移除。
SET NOCOUNT ON;
`;
let fixed = 0;
for (const j of jobs) {
  let d = defs[j.v];
  if (!d) { console.log('❌ 无定义 ' + j.v); continue; }
  let changed = false;
  for (const c of j.cols) {
    const selFrom = new RegExp(`(h|l|s|t)\\.${c.replace(/[()]/g, m => '\\' + m)}\\s+AS\\s+\\[${c}\\]`, 'g');
    if (selFrom.test(d)) { d = d.replace(selFrom, `NULL AS [${c}]`); changed = true; }
    else {
      // 兜底:x.[列] 直接引用(无 AS) → NULL AS [列]
      const re2 = new RegExp(`(h|l|s|t)\\.\\[${c}\\]`, 'g');
      if (re2.test(d)) { d = d.replace(re2, `NULL AS [${c}]`); changed = true; }
      const re3 = new RegExp(`(h|l|s|t)\\.${c}(?![\\w\\]])`, 'g');
      if (re3.test(d)) { d = d.replace(re3, `NULL AS [${c}]`); changed = true; }
    }
    // GROUP BY 残留(现在成了 GROUP BY NULL AS [列] 的非法形态) → 移除该分组项
    const gb = new RegExp(`(GROUP BY[^']*?)NULL AS \\[${c}\\]`, 'g');
    d = d.replace(gb, (m, p1) => p1 + 'NULL'); // GROUP BY 里 NULL AS 非法 → 用 NULL 占位(等价单组)
  }
  if (!changed) { console.log('⚠ 未变化 ' + j.v + ' (定义可能已兼容或形态不同): ' + j.cols.join(',')); continue; }
  fixed++;
  sql += `\n-- ${j.pc} → ${j.v} (缺列: ${j.cols.join('/')})\nEXEC(N'${d.replace(/'/g, "''")}');\n`;
}
sql += `\nPRINT N'migrate-align-views-20260924 完成(${fixed}/${jobs.length})';\n`;
fs.writeFileSync('tools/migrate-align-views-20260924.sql', sql, 'utf8');
console.log(`✅ 生成迁移: 修复 ${fixed}/${jobs.length} 个视图 → tools/migrate-align-views-20260924.sql`);
