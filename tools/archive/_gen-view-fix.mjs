// _gen-view-fix.mjs — 生成 20 个视图的缺列兼容修复 SQL(缺列 SELECT 引用→NULL AS;GROUP BY 引用→移除)
// 数据源:面板扫描结果 + 库内视图定义;输出 tools/migrate-align-views-20260924.sql(幂等 CREATE OR ALTER)
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

// 面板 → 视图名
const panelView = JSON.parse(execSync(
  `docker exec mssql2019 bash -c "/opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P Yinjia@2026 -C -d HSDZ_MES -f 65001 -I -y 0 -Q \\"SET NOCOUNT ON; SELECT panel_code+'|'+ISNULL(line_table,'') FROM yj_panel WHERE panel_code IN ('${Object.keys(bad).join("','")}')\\""`,
  { shell: true, encoding: 'utf8', maxBuffer: 1e8 }))
  .split('\n').map(l => l.trim().replace(/\r$/, '')).filter(l => l.includes('|'));
const viewOf = Object.fromEntries(panelView.map(l => l.split('|')));

let out = `-- migrate-align-views-20260924.sql — 视图缺列兼容修复(2026-09-24 全面板扫描产物)
-- 背景:远程库对一批 *_DETAIL/*_STATS 视图做过库上直改(缺列表 NULL AS 布局列)但未入迁移链;
--      本地库视图为旧版(真列引用)→ 面板列表 500(Invalid column)。本支把缺列引用改 NULL AS 对齐远程设计。
-- 幂等:CREATE OR ALTER,可重复执行。
SET NOCOUNT ON;
`;
const jobs = [];
for (const [pc, cols] of Object.entries(bad)) {
  const v = viewOf[pc];
  if (!v) { console.log(`⚠ ${pc}: 无视图映射`); continue; }
  jobs.push({ pc, v, cols });
  console.log(`${pc} → ${v} 缺: ${cols.join(',')}`);
}
fs.writeFileSync('tools/archive/_viewfix-jobs.json', JSON.stringify(jobs));
console.log('jobs:', jobs.length, '—— 下一步逐个拉定义生成');
