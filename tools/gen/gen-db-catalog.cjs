#!/usr/bin/env node
/**
 * 生成 docs/development/数据库表清单.md（开发规范·数据库表清单）
 *
 * 输入（由 GenDbCatalogDump.java 从正式库 HSDZ_MES 实时导出）：
 *   tools/gen/db-catalog-tables.tsv   表/视图 名称 + MS_Description + 行数 + 列数
 *   tools/gen/db-catalog-panels.tsv   yj_panel 全表（面板 → 头表/行表 中文名对照）
 * 输出：
 *   docs/development/数据库表清单.md
 *
 * 用法（在 YINJIA-MES 根目录，改完库后重跑）：
 *   java -cp tools/lib/mssql-jdbc.jar tools/gen/GenDbCatalogDump.java
 *   node tools/gen/gen-db-catalog.cjs
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(ROOT, 'docs', 'development', '数据库表清单.md');

// ── 读表清单 ───────────────────────────────────────────────────────────────
function readTsv(p) {
  const lines = fs.readFileSync(p, 'utf8').replace(/^﻿/, '').trim().split(/\r?\n/);
  const head = lines[0].split('\t');
  return lines.slice(1).map((l) => {
    const f = l.split('\t');
    const o = {};
    head.forEach((h, i) => (o[h] = f[i] === undefined ? '' : f[i]));
    return o;
  });
}
const tables = readTsv(path.join(ROOT, 'tools', 'gen', 'db-catalog-tables.tsv'));
const panels = readTsv(path.join(ROOT, 'tools', 'gen', 'db-catalog-panels.tsv'));

// ── 面板 → 表 反向映射（取中文面板名，作为表的权威中文名来源） ────────────────
const panelOf = {};
for (const p of panels) {
  for (const t of [p.head_table, p.line_table]) {
    if (!t) continue;
    (panelOf[t] = panelOf[t] || []).push({ code: p.panel_code, name: p.panel_name });
  }
}

// ── 分组规则（顺序匹配，首个命中即定组） ─────────────────────────────────────
const G = (key, title, desc) => ({ key, title, desc, rows: [] });
const GROUPS = [
  G('yj', '一、系统元数据与运行时（`yj_`）',
    '面板引擎的数据驱动底座：面板/字段/翻译/状态/权限全部在这几张表里，**加面板=插行不改代码**（§代码规范 B1）。'),
  G('base', '二、基础档案（`bs_`）',
    '主数据层：物料/BOM/仓库/工序/工序路线/往来单位/质检项目等。基础档案走**严格单单据结构**（`archive` 模式，place 仅 detail）。'),
  G('doc', '三、业务单据头行表（`bd_` 头 / `bl_` 行）',
    '单据层：`bd_*` = 单据头（单号、日期、往来单位、状态、asp_* 审计列），`bl_*` = 单据行（明细）。头行成对出现，`yj_panel.head_table/line_table` 指过来。'),
  G('rd', '四、研发管理（`rd_`）',
    '研发管理模块：立项/计划/产品文件/测试记录/项目进度。多数是 `*_head` + `*_detail` 成对（doc 模式），`rd_*` 无后缀的是**旧单表**（已被 head/detail 取代，保留兼容）。'),
  G('qc', '五、品质管理（`qc_`）',
    '品检分流后的质检单据：来料检验/制程检验/不合格处理/特采/紧急放行等，全部头行成对。'),
  G('wo', '六、生产执行（`wo_` / 各工序记录表）',
    '工单、报工、工序进度、齐套排单，以及五道工序（混料/成型/切炭/组装/装箱）的过程记录单与设备点检/保养。'),
  G('pr', '七、已下架面板的表（`pr_*` / 部分 `wo_*`，保留历史数据）',
    '早期 PR_* 系列与部分 WO_* 面板所用单表，`yj_panel` 中仍有注册但已下架；**新功能禁止再用这批表**，清理前需先确认无历史数据依赖。'),
  G('erp', '八、ERP 同步与系统级联动',
    '金蝶云·星辰导入通道、生单占用链、报表列设置、单据号池。'),
  G('legacy', '九、经典 HSDZ 遗留表（拼音缩写，非 MES 自有结构）',
    '老系统（HSDZ）遗留：`dm_*` 代码表、`s_*` 系统表、`order_*`/`inh`/`outh`/`kucun`/`mate` 等老单据表。'
    + '**部分仍被面板使用**（见「关联面板」列，如 CKDA/KHDD/RKD/CKD/STOCK_STATUS/WLBOM），改动前先确认面板依赖；新建功能一律走 `bs_`/`bd_`/`bl_` 新结构。\n\n'
    + '> ⚠️ `dm_key`（接口 Key 值表）**含明文密钥**——按 [开发与质量](开发与质量.md) §5 安全要求，禁止导出/入库/打进部署包；'
    + '库备份对外交付前先脱敏。`gscs`/`s_xtcs` 等参数表同属「改动前先看一眼内容」的范围。'),
  G('junk', '十、备份 / 临时 / 待清理表',
    '改名残留（`RENAME_*`）、结构性调整前备份（`*_bak_*`）、临时表（`tmp_*`/`t1`/`t2`）。**新代码禁止引用**；清理见 `docs/development/技术债清单.md`。'),
];

// 遗留/待清理的显式名单（prefix 规则兜不住的部分）
const JUNK = new Set(['tmp_excel', 'tmp_report', 'tmp_report_head', 't1', 't2', 'log']);
const ERP = new Set(['erp_imp_log', 'erp_imp_row', 'form_flow_link', 'report_column_settings', 's_allno']);
const WO = new Set([
  'day_report', 'day_report_detail', 'mix_record', 'mix_record_detail', 'gran_record', 'gran_record_detail',
  'feed_confirm', 'feed_confirm_detail', 'pack_confirm', 'pack_confirm_detail', 'wh_record', 'wh_record_detail',
  'rod_return', 'rod_return_detail', 'equip_check', 'equip_check_detail', 'maint_plan', 'maint_plan_detail',
  'qr_batch_registry', 'sample_req', 'sample_req_detail',
]);

/** 面板已下架、表保留历史数据的（挪出在用分组，避免误当成可改的表） */
const DOWN = new Set(['wo_line_stock', 'wo_material_pick', 'wo_stage_report']);

function classify(t) {
  const n = t.name;
  if (/^RENAME_/.test(n) || /_bak_\d{6,8}$/.test(n) || JUNK.has(n)) return 'junk';
  if (ERP.has(n)) return 'erp';
  if (DOWN.has(n) || /^pr_/.test(n)) return 'pr';
  if (/^yj_/.test(n)) return 'yj';
  if (/^bs_/.test(n)) return 'base';
  if (/^(bd_|bl_)/.test(n)) return 'doc';
  if (/^rd_/.test(n)) return 'rd';
  if (/^qc_/.test(n)) return 'qc';
  if (/^wo_/.test(n) || WO.has(n)) return 'wo';
  return 'legacy';
}

// ── 中文名：DB 说明 > 面板名 > 空 ────────────────────────────────────────────
// （实库里 23 张表无 MS_Description，其中 21 张是 *_head/*_detail 成对模板表，
//   由「头部表面板名 + 头/行」推导；剩余靠 panels 对照与人工补充）
const MANUAL = {
  sl_recv: '送料暂收单头表',
  sl_recv_detail: '送料暂收单行表',
  rd_progress_detail_bak_20260918: '备份/改名残留（rd_progress_detail 20260918 备份，可清理）',
  mate: 'BOM（物料清单，经典遗留；面板 WLBOM 在用，新功能走 bs_bom）',
  mate_jtsh: 'BOM 子件阶梯损耗率（经典遗留）',
  dm_key: '各种软件接口 Key 值表（遗留）⚠️ **含明文接口密钥**——禁止导出/入仓/打进部署包，导出库做交付前须先脱敏',
  dm_langue: '语言（作废，多语言走 yj_locale/yj_translation）',
  dm_py: '拼音码（遗留，6764 行，仅老系统模糊检索用）',
};

function zhName(t) {
  if (MANUAL[t.name]) return MANUAL[t.name];
  if (t.desc) return t.desc;
  const p = (panelOf[t.name] || [])[0];
  // 视图本身就是报表/统计口径，不加「头表/行表」后缀（面板名已经是「XX明细表」「XX统计表」）
  if (p && t.kind === 'TABLE') return p.name + (/detail$/.test(t.name) || /^bl_/.test(t.name) ? '（行表）' : '（头表）');
  if (p) return p.name;
  return '—';
}

// ── 组装 ────────────────────────────────────────────────────────────────────
for (const t of tables) {
  const g = GROUPS.find((x) => x.key === classify(t));
  (t.kind === 'VIEW' ? (g.v = g.v || []) : (g.rows = g.rows)).push(t);
}
for (const g of GROUPS) g.rows.sort((a, b) => a.name.localeCompare(b.name, 'en'));

function noteOf(t) {
  const p = panelOf[t.name] || [];
  const uniq = [...new Set(p.map((x) => `${x.code}（${x.name}）`))];
  return uniq.length ? uniq.join('、') : '';
}

/** 表格单元格：`|` 必须转义，否则说明里的竖线（如 模式doc|flat|archive）会撑破表格列 */
const esc = (s) => String(s || '').replace(/\|/g, '\\|');

function tableBlock(rows) {
  const out = [];
  out.push('| 表名 | 中文名称 / 说明 | 列数 | 关联面板 |');
  out.push('|---|---|---:|---|');
  for (const t of rows) {
    out.push(`| \`${t.name}\` | ${esc(zhName(t)) || '—'} | ${t.colcount} | ${esc(noteOf(t)) || '—'} |`);
  }
  return out.join('\n');
}

const date = new Date().toISOString().slice(0, 10);
const nTables = tables.filter((t) => t.kind === 'TABLE').length;
const nViews = tables.filter((t) => t.kind === 'VIEW').length;

const doc = [];
doc.push('# 数据库表清单(YINJIA-MES)');
doc.push('');
doc.push('| 属性 | 内容 |');
doc.push('|---|---|');
doc.push('| 文档类型 | 开发规范·数据库表清单 |');
doc.push('| 适用场景 | 新增/修改表、查表结构、判断「这张表能不能动」 |');
doc.push('| 维护状态 | 生效 |');
doc.push('| 数据口径 | 正式库 `HSDZ_MES`（测试库 `HSDZ_MES_TEST` 结构一致，见 [环境与数据库](环境与数据库.md)） |');
doc.push('| 数据来源 | `sys.tables` / `sys.views` + 扩展属性 `MS_Description` + `yj_panel` 面板对照 |');
doc.push(`| 生成日期 | ${date} |`);
doc.push(`| 覆盖范围 | ${nTables} 张表 + ${nViews} 个视图（含遗留与备份表，全部列出不留盲区） |`);
doc.push('| 生成方式 | 在仓库根目录依次执行:① `java -cp tools/lib/mssql-jdbc.jar tools/gen/GenDbCatalogDump.java`(JDBC 导实库,SQL 走文件避免中文乱码);② `node tools/gen/gen-db-catalog.cjs`(按下方分组渲染本文档) |');
doc.push('');
doc.push('> **本清单是表的「户口本」，不是结构文档**：列级定义以实库为准（`tools/setup-db.sql` + `tools/db-migrations.txt` 链）。');
doc.push('> 新增表必须同时：① 在 `db-migrations.txt` 追加幂等迁移脚本；② 加 `MS_Description` 中文说明；③ 重跑上面的生成命令刷新本文档。');
doc.push('');
doc.push('## 0. 表命名与归属规范（强制）');
doc.push('');
doc.push('| 前缀 / 形态 | 含义 | 归属模块 | 建表要求 |');
doc.push('|---|---|---|---|');
doc.push('| `yj_` | 面板引擎元数据与运行时（面板/字段/翻译/状态/权限/日志） | 系统 | 只由引擎读写，业务代码禁止直连 |');
doc.push('| `bs_` | 基础档案（主数据） | 基础设置 | 必须走**单单据结构**（`archive` 模式）；保存必须全量提交 |');
doc.push('| `bd_` / `bl_` | 业务单据 **头表** / **行表**（成对） | 订单/生产/仓库管理 | 必须齐备 `asp_user1/2`+`asp_time1/2` 审计列；删除=软删 |');
doc.push('| `rd_` | 研发管理模块单据 | 研发管理 | `*_head`+`*_detail` 成对；无后缀的旧单表只读保留 |');
doc.push('| `qc_` | 品质管理单据 | 品质管理 | 头行成对 |');
doc.push('| `wo_` | 生产执行（工单/报工/进度） | 生产管理 | 头行成对 |');
doc.push('| `dm_` / `s_` / 拼音缩写 | **经典 HSDZ 遗留**，非 MES 自有结构 | 遗留 | 新功能**禁止**使用；面板仍在用的（见下表「关联面板」）改动前须评估 |');
doc.push('| `RENAME_` / `*_bak_*` / `tmp_*` / `t1` / `t2` | 备份与临时 | 待清理 | 禁止引用；清理走技术债清单 |');
doc.push('');
doc.push('**通用硬约束**（表清单之外的「列级」规范见 [代码规范与防臃肿](代码规范与防臃肿.md) §C3 与 [开发与质量](开发与质量.md) §3「列名安全规范」）：');
doc.push('');
doc.push('- 列名**禁止含 `.`**；含 `%`/空格等特殊字符的列，SQL 中必须写 `t.[列名]`。');
doc.push('- 一切写入经 `asp_user1/2` + `asp_time1/2` 留痕；删除=软删（`canceled` 状态）。');
doc.push('- 库变更**禁止手工改库**：一律写幂等迁移脚本进 `tools/db-migrations.txt`（§代码规范 E2）。');
doc.push('- 表的中文说明写进 `MS_Description` 扩展属性——本文档的中文名就是从这里读的。');
doc.push('');
doc.push('---');
doc.push('');
for (const g of GROUPS) {
  if (!g.rows.length) continue;
  doc.push(`## ${g.title}`);
  doc.push('');
  if (g.desc) { doc.push(g.desc); doc.push(''); }
  doc.push(`> 共 ${g.rows.length} 张`);
  doc.push('');
  doc.push(tableBlock(g.rows));
  doc.push('');
}
// 视图
const views = tables.filter((t) => t.kind === 'VIEW');
const viewGroups = GROUPS.filter((g) => g.v && g.v.length);
doc.push('---');
doc.push('');
doc.push(`## 附:视图清单（${nViews} 个）`);
doc.push('');
doc.push('视图服务于报表/统计面板（`flat` 模式），**字段从视图列自动发现并注册进 `yj_field`**——');
doc.push('视图重建后必须按 `sys.columns` 重新注册字段，不可手工硬编码（见 [开发与质量](开发与质量.md) §3「列名安全规范」）。');
doc.push('');
doc.push('### A. MES 视图（`v_`，业务在用）');
doc.push('');
doc.push('| 视图名 | 中文名称 / 说明 | 列数 | 关联面板 |');
doc.push('|---|---|---:|---|');
for (const t of views.filter((t) => /^v_/.test(t.name)).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
  doc.push(`| \`${t.name}\` | ${esc(zhName(t)) || '—'} | ${t.colcount} | ${esc(noteOf(t)) || '—'} |`);
}
doc.push('');
doc.push('### B. 经典 HSDZ 遗留视图（`View_` / `VIEW_`）');
doc.push('');
doc.push('老系统的库存/订单数量/成本类视图（`View_llrk*` 领料入库、`View_ZZPQTY*` 在制品数量、`View_OD_WLQTY*` 订单物料数量、`View_od_cost*` 订单成本等）。');
doc.push('**新报表禁止再建这一类视图**；如需沿用老口径，先在 `yj_field` 里把字段注册成面板再引用。');
doc.push('');
const legacyViews = views.filter((t) => !/^v_/.test(t.name)).sort((a, b) => a.name.localeCompare(b.name, 'en'));
doc.push('| 视图名 | 关联面板 |');
doc.push('|---|---|');
for (const t of legacyViews) doc.push(`| \`${t.name}\` | ${esc(noteOf(t)) || '—'} |`);
doc.push('');
doc.push('---');
doc.push('');
doc.push('## 维护记录');
doc.push('');
doc.push('| 版本 | 日期 | 说明 |');
doc.push('|---|---|---|');
doc.push(`| v1.0 | ${date} | 初版:全库 ${nTables} 表 + ${nViews} 视图按十组登记（表名+中文名+列数+关联面板），附分组命名规范 |`);
doc.push('');

// 自检：说明里的 `|`（如「模式doc|flat|archive」）必须已转义，否则 Markdown 表格会撑破列
const SENT = '\u0000';
const broken = doc
  .map((l, i) => [l, i + 1])
  .filter(([l]) => /^\| `/.test(l))
  .filter(([l]) => ![4, 2].includes(l.replace(/\\\|/g, SENT).slice(1, -1).split('|').length));
if (broken.length) {
  console.error(`✗ ${broken.length} 行 Markdown 列数异常（说明含未转义的 |）:`);
  for (const [l, n] of broken.slice(0, 10)) console.error(`  line ${n}: ${l.slice(0, 100)}`);
  process.exit(1);
}

fs.writeFileSync(OUT, doc.join('\n'), 'utf8');
console.log(`written ${path.relative(ROOT, OUT)}  (${tables.length} objects)`);
for (const g of GROUPS) console.log(`  ${g.key.padEnd(7)} ${String(g.rows.length).padStart(4)}  ${g.title}`);
console.log(`  views   ${String(views.length).padStart(4)}`);
