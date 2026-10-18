/**
 * _rd-cleanup-by-panels.mjs —— 清空「研发管理」模块的业务数据(2026-10-16)
 *
 * 范围由 yj_panel 精确定义:所有 panel_code LIKE 'RD%' 的面板,取其 head_table / line_table 清空,
 * 并按面板码清 状态/修改记录/审批记录/单据流/使用日志。
 *
 * 为什么不直接用 tools/migrate-rd-cleanup.sql:那份只覆盖 3 个面板(立项申请/项目实施计划/项目进度查询),
 * 而库里有 26 个 RD_* 面板;本次按面板元数据全量对齐。号池归零仍用那份脚本(LXA/LXB/LXJ)。
 *
 * ⚠ 不动的两张:
 *   · rd_sinter_tolerance(烧结尺寸表)—— asp_user1='system' 种子灌入的**标准参数表**(车间/型号/公差),
 *     不是业务数据,清掉会让该面板失去标准值且无源可恢复;
 *   · yj_share_file —— 通用共享文件库表(当前 0 行)。
 *
 * 用法(仓库根):
 *   node tools/archive/_rd-cleanup-by-panels.mjs            # 空跑:只列会被清的表与行数
 *   node tools/archive/_rd-cleanup-by-panels.mjs --apply     # 执行
 *   node tools/archive/_rd-cleanup-by-panels.mjs --apply --db HSDZ_MES_TEST
 */
import mssql from '../../deploy/node_modules/mssql/index.js';

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };
const APPLY = argv.includes('--apply');
const DB = arg('db', 'HSDZ_MES');

const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: DB, user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026',
  options: { encrypt: false, trustServerCertificate: true },
  pool: { max: 1, min: 1, idleTimeoutMillis: 30000 },
});
const q = async (s) => (await pool.request().query(s)).recordset;

const panels = await q("SELECT panel_code, panel_name, head_table, line_table FROM yj_panel WHERE panel_code LIKE 'RD%' ORDER BY panel_code");
const SKIP = new Set(['rd_sinter_tolerance', 'yj_share_file']);
const tables = new Set();
for (const p of panels) for (const t of [p.line_table, p.head_table]) if (t && !SKIP.has(t)) tables.add(t);

console.log(`库 ${DB} | RD_* 面板 ${panels.length} 个 | 待清表 ${tables.size} 张 | 模式 ${APPLY ? 'APPLY(执行)' : 'DRY-RUN(只统计)'}`);
console.log('');
console.log('将被清空且**当前非空**的表:');
let tot = 0;
for (const t of [...tables].sort()) {
  const ex = (await q(`SELECT COUNT(*) v FROM sys.tables WHERE name = N'${t}'`))[0].v;
  if (!ex) { console.log(`  ${t.padEnd(26)} ★表不存在`); continue; }
  const n = (await q(`SELECT COUNT(*) v FROM dbo.[${t}]`))[0].v;
  if (n) { tot += n; console.log(`  ${t.padEnd(26)} ${String(n).padStart(4)} 行`); }
}
console.log(`  非空合计 ${tot} 行(其余表本就为空)`);
console.log('');
console.log(`跳过(非业务数据/通用表): ${[...SKIP].join(', ')}`);

const codes = panels.map((p) => p.panel_code);
const inList = codes.map((c) => `N'${c}'`).join(',');
console.log('');
console.log('将按面板码清理: yj_doc_status / yj_doc_modify_log / yj_form_approval / form_flow_link(source|target)');
for (const t of ['yj_doc_status', 'yj_doc_modify_log', 'yj_form_approval']) {
  const n = (await q(`SELECT COUNT(*) v FROM ${t} WHERE panel_code IN (${inList})`))[0].v;
  console.log(`  ${t.padEnd(22)} ${n} 行`);
}
const fl = (await q(`SELECT COUNT(*) v FROM form_flow_link WHERE source_panel_code IN (${inList}) OR target_panel_code IN (${inList})`))[0].v;
console.log(`  ${'form_flow_link'.padEnd(22)} ${fl} 行`);

if (!APPLY) { console.log('\n[DRY-RUN] 未改动。加 --apply 执行。'); await pool.close(); process.exit(0); }

console.log('\n-- 执行 --');
// 行表先于头表
for (const p of panels) if (p.line_table && !SKIP.has(p.line_table)) {
  const r = await pool.request().query(`DELETE FROM dbo.[${p.line_table}]`);
  if (r.rowsAffected[0]) console.log(`  [清] ${p.line_table.padEnd(26)} ${r.rowsAffected[0]} 行`);
}
for (const p of panels) if (p.head_table && !SKIP.has(p.head_table)) {
  const r = await pool.request().query(`DELETE FROM dbo.[${p.head_table}]`);
  if (r.rowsAffected[0]) console.log(`  [清] ${p.head_table.padEnd(26)} ${r.rowsAffected[0]} 行`);
}
for (const t of ['yj_doc_status', 'yj_doc_modify_log', 'yj_form_approval']) {
  const r = await pool.request().query(`DELETE FROM ${t} WHERE panel_code IN (${inList})`);
  console.log(`  [清] ${t.padEnd(26)} ${r.rowsAffected[0]} 行`);
}
const rf = await pool.request().query(`DELETE FROM form_flow_link WHERE source_panel_code IN (${inList}) OR target_panel_code IN (${inList})`);
console.log(`  [清] ${'form_flow_link'.padEnd(26)} ${rf.rowsAffected[0]} 行`);

console.log('\n-- 复核:研发各表面板应全为 0(除跳过的两张)--');
let left = 0;
for (const t of [...tables].sort()) {
  const ex = (await q(`SELECT COUNT(*) v FROM sys.tables WHERE name = N'${t}'`))[0].v;
  if (!ex) continue;
  const n = (await q(`SELECT COUNT(*) v FROM dbo.[${t}]`))[0].v;
  if (n) { left += n; console.log(`  ★ ${t} 仍有 ${n} 行`); }
}
console.log(left === 0 ? '  研发业务表已全部清空 ✓' : `  ★ 残留 ${left} 行`);
await pool.close();
