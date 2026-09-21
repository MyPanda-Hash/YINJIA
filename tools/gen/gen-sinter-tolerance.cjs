/**
 * gen-sinter-tolerance.cjs — 由设计源《20267月22日-最新烧结配方模板-1.xlsx》sheet「烧结尺寸表」
 * 生成 `tools/migrate-sinter-tolerance.sql`(60 行模具↔炭棒内外径公差对照 + 面板登记)。
 *
 * 为什么要有它:60 行数据手抄必错且无人能复核;脚本把"从设计源到库"变成可重跑、可 diff 的确定性过程。
 * 源文件 = tools/archive/_walk/src-moldFormula-烧结尺寸表.txt(表格 walk 产物,R4~R63 共 60 行)。
 *
 * 口径(见 docs/design/研发管理-新面板设计与改动方案.md §12.4):
 *   - 落点 = 新建标准表 rd_sinter_tolerance,不塞进商品/标准库(10 列 + 60 行,标准库 4000 字上限塞不下);
 *   - 维护 = 登记成**档案面板**(mode='archive'),直接用现成的列表/内联编辑,不另写维护界面;
 *   - 脏值**原样保留**(业务看得懂,清洗反而丢信息):长度范围里混了备注的两行、带"（只可做低精度）"的两行,
 *     推导计算时只解析前段 `NNN-NNN`(见 frontend/src/core/mold/recipeSheet.js 的 parseLengthRange)。
 *
 * 用法:node tools/gen/gen-sinter-tolerance.cjs
 * 产出:tools/migrate-sinter-tolerance.sql(幂等:建表/登记按存在判,种子按 车间+型号 去重)
 */
'use strict'

const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.join(__dirname, '..', '..')
const SRC = path.join(ROOT, 'tools', 'archive', '_walk', 'src-moldFormula-烧结尺寸表.txt')
const OUT = path.join(ROOT, 'tools', 'migrate-sinter-tolerance.sql')

const text = fs.readFileSync(SRC, 'utf8')
const rows = []
for (const line of text.split(/\r?\n/)) {
  const m = line.match(/^R(\d+): \[A\]=(.+?)(?: \[B\]=(.*?))?(?: \[C\]=(.*?))?(?: \[D\]=(.*?))?(?: \[E\]=(.*?))?(?: \[F\]=(.*?))?(?: \[G\]=(.*?))?(?: \[H\]=(.*?))?(?: \[I\]=(.*?))?$/)
  if (!m) continue
  const [, no, workshop, model, moldSize, rodSize, barOd, barOdTol, barId, barIdTol, lengthRange] = m
  // 车间列可能是 `1`、`4`,也可能是 `1/3`(两个车间共用该型号,如 45*25)——只跳表头
  if (!/^[\d\s/]+$/.test(String(workshop).trim())) continue
  rows.push({
    no: Number(no),
    workshop: String(workshop).trim(),
    model: String(model || '').trim(),
    moldSize: String(moldSize || '').trim(),
    rodSize: String(rodSize || '').trim(),
    barOd: String(barOd || '').trim(),
    barOdTol: String(barOdTol || '').trim(),
    barId: String(barId || '').trim(),
    barIdTol: String(barIdTol || '').trim(),
    // walk 产物把单元格内换行写成 '⏎';这里还原成真换行(设计原样),别丢信息
    lengthRange: String(lengthRange || '').trim().replace(/⏎/g, '\n'),
  })
}

if (rows.length !== 60) throw new Error(`期望 60 行(设计源 A1:I63,数据 R4~R63),实际解析到 ${rows.length} 行`)
const dup = rows.map((r) => r.workshop + '|' + r.model).filter((k, i, a) => a.indexOf(k) !== i)
if (dup.length) throw new Error('车间+型号 有重复:' + dup.join(','))
const dirty = rows.filter((r) => r.lengthRange !== '' && !/^\d+-\d+$/.test(r.lengthRange))
const byWorkshop = rows.reduce((acc, r) => { acc[r.workshop] = (acc[r.workshop] || 0) + 1; return acc }, {})

const q = (s) => "N'" + String(s).replace(/'/g, "''") + "'"

const FIELDS = [
  ['车间', '车间', '文本', 'query,detail', 10, 90, 1, 1],
  ['型号', '型号', '文本', 'query,detail', 20, 130, 1, 1],
  ['模具尺寸', '模具尺寸', '文本', 'query,detail', 30, 100, 1, 0],
  ['中心杆尺寸', '中心杆尺寸', '文本', 'query,detail', 40, 110, 1, 0],
  ['炭棒外径', '炭棒外径', '文本', 'query,detail', 50, 100, 1, 0],
  ['炭棒外径公差', '炭棒外径公差', '文本', 'detail', 60, 110, 1, 0],
  ['炭棒内径', '炭棒内径', '文本', 'query,detail', 70, 100, 1, 0],
  ['炭棒内径公差', '炭棒内径公差', '文本', 'detail', 80, 110, 1, 0],
  ['长度范围', '长度范围', '文本', 'query,detail', 90, 170, 1, 0],
  ['停用', '停用', '是否', 'detail', 100, 80, 1, 0],
]
const TRANSLATIONS = [
  ['field', '车间', 'Workshop'], ['field', '型号', 'Model'],
  ['field', '模具尺寸', 'Mold Size'], ['field', '中心杆尺寸', 'Center Rod Size'],
  ['field', '炭棒外径', 'Rod OD'], ['field', '炭棒外径公差', 'Rod OD Tol.'],
  ['field', '炭棒内径', 'Rod ID'], ['field', '炭棒内径公差', 'Rod ID Tol.'],
  ['field', '长度范围', 'Length Range'],
  ['panel', '烧结尺寸表', 'Sintering Size Table'],
]

const lines = []
lines.push(`/* ============================================================================
   migrate-sinter-tolerance.sql —— 烧结尺寸表(60 行模具↔炭棒内外径公差对照)+ 档案面板登记
   ============================================================================
   ⚠ 本文件由 tools/gen/gen-sinter-tolerance.cjs 从设计源自动生成,不要手改。
     设计源:《20267月22日-最新烧结配方模板-1.xlsx》sheet「烧结尺寸表」(A1:I63,R4~R63 共 60 行)
     重新生成:node tools/gen/gen-sinter-tolerance.cjs

   用途(见 docs/design/研发管理-新面板设计与改动方案.md §12.4 / CONTEXT.md「配方计算器」):
     配方计算弹窗按「车间 + 型号」从这张表带出炭棒外径/内径与其公差,回填到成型工艺清单页 1 的
     「检验要求 · 炭棒尺寸」四格 —— 工艺员不必再每单手敲;计算用的外径/内径也取自这里(优先于手填)。
   维护:登记成**档案面板**(mode='archive'),用现成的列表 + 内联编辑,不另写维护界面。

   脏值**原样保留**(§12.4 明示):长度范围里混备注的两行、带"（只可做低精度）"的两行,业务看得懂;
   程式只解析前段 NNN-NNN。另外 walk 产物里的单元格内换行 '⏎' 已还原成真换行。

   幂等:表/字段/译名按存在判;种子按 **车间+型号** 去重(已存在不覆盖,便于人工修正后重跑)。
   两个账套都要执行(先正式 HSDZ_MES、后测试 HSDZ_MES_TEST),执行须带 QUOTED_IDENTIFIER ON(sqlcmd -I)。
   ============================================================================ */

SET NOCOUNT ON;
GO

/* ── ① 建表(中文列名,与 yj_field.label 同名同序)+ 中文注明(AGENTS 硬规范)── */
IF OBJECT_ID('rd_sinter_tolerance') IS NULL
BEGIN
    CREATE TABLE rd_sinter_tolerance (
        id int IDENTITY(1,1) PRIMARY KEY,
        [车间] nvarchar(20) NULL,
        [型号] nvarchar(40) NULL,
        [模具尺寸] nvarchar(20) NULL,
        [中心杆尺寸] nvarchar(20) NULL,
        [炭棒外径] nvarchar(20) NULL,
        [炭棒外径公差] nvarchar(20) NULL,
        [炭棒内径] nvarchar(20) NULL,
        [炭棒内径公差] nvarchar(20) NULL,
        [长度范围] nvarchar(80) NULL,
        [停用] bit NULL DEFAULT 0,
        seq int NULL DEFAULT 0,
        asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL,
        asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL,
        asp_cancel char(1) NULL DEFAULT 'N'
    );
    PRINT N'migrate-sinter-tolerance.sql:已建表 rd_sinter_tolerance';
END
ELSE PRINT N'migrate-sinter-tolerance.sql:表 rd_sinter_tolerance 已存在';
GO

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('rd_sinter_tolerance') AND minor_id = 0 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'烧结尺寸表:烧结车间模具对应的炭棒内外径与公差对照(配方计算按车间+型号带出尺寸)', N'SCHEMA', N'dbo', N'TABLE', N'rd_sinter_tolerance';
GO
DECLARE @cols TABLE (c sysname, d nvarchar(200));
INSERT INTO @cols VALUES
 (N'车间', N'烧结车间编号(与成型工艺清单的生产车间同口径)'),
 (N'型号', N'模具型号(外径*内径),车间内唯一'),
 (N'模具尺寸', N'模具外径 mm'),
 (N'中心杆尺寸', N'中心杆外径 mm'),
 (N'炭棒外径', N'炭棒外径 mm(成品)'),
 (N'炭棒外径公差', N'炭棒外径公差(含 ± 号,原样保留)'),
 (N'炭棒内径', N'炭棒内径 mm(成品)'),
 (N'炭棒内径公差', N'炭棒内径公差(含 ± 号,原样保留)'),
 (N'长度范围', N'该模具可做长度范围 NNN-NNN;个别行带车间备注/精度说明(原样保留,程式只解析前段数字)');
DECLARE @c sysname, @d nvarchar(200);
DECLARE cur CURSOR FOR SELECT c, d FROM @cols;
OPEN cur; FETCH NEXT FROM cur INTO @c, @d;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
                   WHERE major_id = OBJECT_ID('rd_sinter_tolerance')
                     AND minor_id = COLUMNPROPERTY(OBJECT_ID('rd_sinter_tolerance'), @c, 'ColumnId')
                     AND name = 'MS_Description')
        EXEC sp_addextendedproperty N'MS_Description', @d, N'SCHEMA', N'dbo', N'TABLE', N'rd_sinter_tolerance', N'COLUMN', @c;
    FETCH NEXT FROM cur INTO @c, @d;
END
CLOSE cur; DEALLOCATE cur;
GO

/* ── ② 登记档案面板(用现成列表/内联编辑维护 60 行)── */
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'RD_SINTER_TOL')
    INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group, panel_name_en)
    VALUES ('RD_SINTER_TOL', N'烧结尺寸表', N'基础设置', 'archive', 'rd_sinter_tolerance', NULL, NULL, 'id', N'型号', NULL, NULL, 200, 'items', N'基础设置', 'Sintering Size Table');
GO

/* ── ③ 字段登记(place 照抄既有档案面板口径:列表列 query,detail)── */
${FIELDS.map(([col, label, type, place, seq, width, editable, required]) => `IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'RD_SINTER_TOL' AND col_name = ${q(col)})
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
    VALUES ('RD_SINTER_TOL', ${q(col)}, ${q(label)}, ${q(type)}, NULL, NULL, NULL, NULL, ${q(place)}, ${seq}, ${width}, ${editable}, ${required}, 0, 1);`).join('\n')}
GO

/* ── ④ 译名(AGENTS:新面板/新字段必须带译名;此处给 en,其余语言由机翻兜底)── */
${TRANSLATIONS.map(([scope, key, en]) => `IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = '${scope}' AND ref_key = ${q(key)} AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('${scope}', ${q(key)}, 'en', ${q(en)}, 'manual');`).join('\n')}
GO

/* ── ⑤ 60 行种子(按 车间+型号 去重;已存在不覆盖)── */
PRINT N'--- 播种 60 行烧结尺寸 ---';
`)
rows.forEach((r, i) => {
  lines.push(`IF NOT EXISTS (SELECT 1 FROM rd_sinter_tolerance WHERE RTRIM([车间]) = ${q(r.workshop)} AND RTRIM([型号]) = ${q(r.model)})
    INSERT INTO rd_sinter_tolerance ([车间],[型号],[模具尺寸],[中心杆尺寸],[炭棒外径],[炭棒外径公差],[炭棒内径],[炭棒内径公差],[长度范围],seq,asp_user1,asp_time1)
    VALUES (${q(r.workshop)}, ${q(r.model)}, ${q(r.moldSize)}, ${q(r.rodSize)}, ${q(r.barOd)}, ${q(r.barOdTol)}, ${q(r.barId)}, ${q(r.barIdTol)}, ${q(r.lengthRange)}, ${i + 1}, 'system', SYSDATETIME());`)
})
lines.push(`GO

/* ── 核验 ── */
SELECT COUNT(*) AS 行数 FROM rd_sinter_tolerance;
SELECT [车间], COUNT(*) AS 行数 FROM rd_sinter_tolerance GROUP BY [车间] ORDER BY [车间];
SELECT COUNT(*) AS 面板登记 FROM yj_panel WHERE panel_code = 'RD_SINTER_TOL';
SELECT COUNT(*) AS 字段登记 FROM yj_field WHERE panel_code = 'RD_SINTER_TOL';
SELECT TOP 3 [车间],[型号],[模具尺寸],[中心杆尺寸],[炭棒外径],[炭棒外径公差],[炭棒内径],[炭棒内径公差],[长度范围] FROM rd_sinter_tolerance ORDER BY seq;
GO
`)

fs.writeFileSync(OUT, lines.join('\n'), 'utf8')
console.log(`已生成 ${path.relative(ROOT, OUT)}`)
console.log(`  烧结尺寸 ${rows.length} 行,按车间:${Object.entries(byWorkshop).map(([k, v]) => `${k}# ${v} 行`).join(' / ')}`)
console.log(`  字段 ${FIELDS.length} 个 + 译名 ${TRANSLATIONS.length} 条`)
console.log(`  脏值(长度范围非纯 NNN-NNN)原样保留 ${dirty.length} 行:`)
dirty.forEach((r) => console.log(`    ${r.workshop}# ${r.model} → ${JSON.stringify(r.lengthRange)}`))
