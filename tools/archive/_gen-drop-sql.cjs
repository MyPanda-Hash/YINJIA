#!/usr/bin/env node
/**
 * 生成 tools/migrate-drop-unused-tables.sql(任务产物;生成后随任务提交)。
 * 输入:archive\_table-audit\drop-tables.txt(244 张)、drop-panels.txt(29 个)
 * 输出:tools/migrate-drop-unused-tables.sql
 * 写法对齐仓库既有迁移:tools/migrate-line-open-drop.sql(头部注释 + 存在性守卫 + 结尾核对 + GO)
 */
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '_table-audit');
const ROOT = path.resolve(__dirname, '..', '..');

const readList = (f) => fs.readFileSync(path.join(DIR, f), 'utf8').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
const tables = readList('drop-tables.txt');
const panels = readList('drop-panels.txt');
const q = (s) => 'N\'' + s.replace(/'/g, "''") + '\'';           // 字面量
const br = (s) => '[' + s.replace(/]/g, ']]') + ']';             // 标识符

const L = [];
L.push('-- migrate-drop-unused-tables.sql — 未用表清理 + 悬空面板元数据回收(2026-09-29 用户拍板)');
L.push('--');
L.push('-- 背景:HSDZ_MES 由外部数据库包(经典 HSDZ/ERP)+ 长期迭代叠加而成,库内 454 表里大量表项目并不使用。');
L.push('--   本脚本按四源审计(① yj_panel 面板绑定且面板在运营 ② 在运营视图依赖 ③ backend/src/main/java +');
L.push('--   frontend/src 运行期 SQL 引用 ④ 业务数据行)判定「未用」后物理删除,并回收连带悬空的面板元数据。');
L.push('-- 证据与清单:tools/archive/_table-audit/(objects|panels|deps|refs|granted|classify|drop-risk|drop-tables|drop-plan)');
L.push(`-- 本次删除 ${tables.length} 张表:`);
L.push('--   · 仅被已下架面板挂靠 29 张(pr_* 25 + wo_line_stock/wo_material_pick/wo_stage_report + dm_ywy)');
L.push('--   · 有数据但无任何引用 68 张(老 HSDZ 遗留:area_*/dm_py/s_sys/permission/kjkm… 合计约 2.6 万行)');
L.push('--   · 空表未接线 20 张(rd_* 旧单表 19 + wo_report(源码注释「停用为遗留表」))');
L.push('--   · 空表遗留未用 62 张 + 备份/临时 66 张(RENAME_*/_bak_*/tmp_*/t1/t2/log)');
L.push('-- 例外保留(逐条有据,勿顺手删):');
L.push('--   yj_schema_log —— tools/DbSync.java 的迁移登记表;删掉会让整条迁移链按「未执行」全量重跑');
L.push('--   erp_imp_row   —— 与在用面板 ERPLG 同属 ERP 导入通道,本仓库无导入代码,可能由外部程序写入(0 行)');
L.push('--   dm_key        —— 含明文接口密钥,属「要脱敏的历史资产」,单独处置');
L.push(`-- 联动:${panels.length} 个已下架面板的 yj_field/yj_role_panel/yj_panel 行与仅它们使用的中文标签译名词条一并回收`);
L.push('--   (不回收 ⇒ 面板指向不存在的表,DbNormAudit 06 项直接 FAIL)。');
L.push('-- 幂等:每步都有存在性守卫;新库场景 = 迁移链先建后删,历史脚本一律不回改(migrate-line-open-drop.sql 先例)。');
L.push('-- 备份:执行前已打全库备份 deploy\\HSDZ_MES_pre_drop_<时间戳>.bak(74MB,RESTORE VERIFYONLY 通过)。');
L.push('-- 注:被删表若有遗留视图(View_llrk*/VIEW_zc 等,自身已无面板绑定、无代码引用)引用,那些视图会失效——');
L.push('--   本脚本不动视图;失效清单见 tools/archive/_table-audit/drop-risk.csv,清理另立任务。');
L.push('');
L.push('SET NOCOUNT ON;');
L.push("IF DB_NAME() = N'master' USE HSDZ_MES;");
L.push('GO');
L.push('');
L.push('-- ── 1. 回收已下架面板的元数据(字段行 → 授权行 → 面板行 → 仅它们使用的译名词条) ──');
L.push('DECLARE @panel TABLE (code sysname PRIMARY KEY);');
L.push('INSERT INTO @panel (code) VALUES');
for (let i = 0; i < panels.length; i++) L.push(`  (${q(panels[i])})${i === panels.length - 1 ? ';' : ','}`);
L.push('');
L.push('DECLARE @pname TABLE (name nvarchar(120) PRIMARY KEY);');
L.push('INSERT INTO @pname (name) SELECT p.panel_name FROM yj_panel p JOIN @panel d ON d.code = p.panel_code;');
L.push('DECLARE @plabel TABLE (label nvarchar(200) PRIMARY KEY);');
L.push('INSERT INTO @plabel (label) SELECT DISTINCT f.label FROM yj_field f JOIN @panel d ON d.code = f.panel_code WHERE f.label IS NOT NULL;');
L.push('');
L.push('DELETE f FROM yj_field f JOIN @panel d ON d.code = f.panel_code;');
L.push('DECLARE @nField int = @@ROWCOUNT;');
L.push('DELETE rp FROM yj_role_panel rp JOIN @panel d ON d.code = rp.panel_code;');
L.push('DECLARE @nGrant int = @@ROWCOUNT;');
L.push('DELETE p FROM yj_panel p JOIN @panel d ON d.code = p.panel_code;');
L.push('DECLARE @nPanel int = @@ROWCOUNT;');
L.push('-- 译名词条:只删「已无任何存活面板/字段引用」的(标签与面板名是全局共享键,不能按面板直接删)');
L.push('DELETE t FROM yj_translation t');
L.push('  WHERE t.scope = N\'field\' AND EXISTS (SELECT 1 FROM @plabel l WHERE l.label = t.ref_key)');
L.push('    AND NOT EXISTS (SELECT 1 FROM yj_field f WHERE f.label = t.ref_key);');
L.push('DECLARE @nTf int = @@ROWCOUNT;');
L.push('DELETE t FROM yj_translation t');
L.push('  WHERE t.scope = N\'panel\' AND EXISTS (SELECT 1 FROM @pname n WHERE n.name = t.ref_key)');
L.push('    AND NOT EXISTS (SELECT 1 FROM yj_panel p WHERE p.panel_name = t.ref_key);');
L.push('DECLARE @nTp int = @@ROWCOUNT;');
L.push("PRINT N'面板元数据回收: 字段 ' + CAST(@nField AS nvarchar(10)) + N' , 授权 ' + CAST(@nGrant AS nvarchar(10))");
L.push("      + N' , 面板 ' + CAST(@nPanel AS nvarchar(10)) + N' , 字段译名 ' + CAST(@nTf AS nvarchar(10)) + N' , 面板译名 ' + CAST(@nTp AS nvarchar(10));");
L.push('GO');
L.push('');
L.push(`-- ── 2. 物理删除 ${tables.length} 张未用表(显式清单,勿改成谓词) ──`);
L.push('DECLARE @dropped int = 0;');
for (const t of tables) {
  L.push(`IF OBJECT_ID(N'dbo.${t.replace(/'/g, "''")}', N'U') IS NOT NULL BEGIN DROP TABLE dbo.${br(t)}; SET @dropped += 1; END`);
}
L.push("PRINT N'未用表删除: ' + CAST(@dropped AS nvarchar(10)) + N' 张';");
L.push('GO');
L.push('');
L.push('-- ── 3. 执行后核对(三项都应如注释所示) ──');
L.push("SELECT N'剩余表数(预期 210)' AS 检查项, COUNT(*) AS 值 FROM sys.tables;");
L.push("SELECT N'指向不存在对象的面板(预期 0)' AS 检查项, COUNT(*) AS 值 FROM yj_panel");
L.push("  WHERE (line_table IS NOT NULL AND OBJECT_ID(line_table) IS NULL)");
L.push("     OR (head_table IS NOT NULL AND OBJECT_ID(head_table) IS NULL);");
L.push("SELECT N'剩余备份/临时表(预期 0;口径同 DbNormAudit.isBackup)' AS 检查项, COUNT(*) AS 值 FROM sys.tables");
L.push("  WHERE LOWER(name) LIKE '%bak%' OR LOWER(name) LIKE 'rename%' OR LOWER(name) LIKE 'tmp%' OR LOWER(name) LIKE 't[0-9]';");
L.push('GO');
L.push('');

const out = path.join(ROOT, 'tools', 'migrate-drop-unused-tables.sql');
fs.writeFileSync(out, L.join('\n'), 'utf8');
console.log(`[done] ${out} (${tables.length} 张表 / ${panels.length} 个面板)`);
