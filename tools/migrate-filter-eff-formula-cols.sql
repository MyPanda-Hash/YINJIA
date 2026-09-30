-- migrate-filter-eff-formula-cols.sql — 功能性滤效(RD_FILTER_EFF)「样品配方」改为**每样品一格**
--
-- 【为什么改】设计原表《数据记录表.xlsx》sheet 功能性滤效:
--   第 10 行 样品配方  merges = C10:G10 + H10:L10  (两个样品 → 两块)
--   第 11 行 样品信息  merges = C11:G11 + H11:L11  (同一分块)
--   第 17 行 测试装置及编号 C17:G17 + H17:L17     (同一分块)
--   ⇒ 三行的列数恒等于「样品数」;而实现里 样品配方 是**一个单字段**(纸面一格跨全部样品列),
--     加列不分裂、减列不清空 —— 2026-09-30 用户口径:「样品配方列数应该跟样品信息同步」。
--
-- 本脚本只做库侧:头表加 样品配方1..6 物理列 + yj_field 注册 + en 译名 + 存量兜底搬迁。
-- 前端渲染与「减列清空」在 frontend/src/core/views/DataRecordSheet.vue +
-- frontend/src/core/sheet/sampleCols.js(按样品铺开的字段名单一真源,单测钉住)。
--
-- ⚠ 旧列 `样品配方`(单字段)**保留不删**:登记仍在(历史值可读),只是不再画在纸上。
--   本机存量:15 张单、0 张填过 样品配方 ⇒ 下面的兜底 UPDATE 实际不改任何行(幂等,留着防漏)。
-- 幂等:加列 IF COL_LENGTH IS NULL;字段行按 (panel_code, col_name, place) NOT EXISTS 去重。
IF DB_NAME() = N'master' USE HSDZ_MES;   -- 仅在未选定库时切正式库(选定测试库/克隆库时不得被切走)
SET NOCOUNT ON;
GO

-- ═══ 1. 头表加列(样品配方1..6;长度与 样品信息1..6 一致 = nvarchar(1000)) ═══
BEGIN TRY
IF COL_LENGTH('rd_filter_eff_head', '样品配方1') IS NULL ALTER TABLE rd_filter_eff_head ADD [样品配方1] nvarchar(1000) NULL;
IF COL_LENGTH('rd_filter_eff_head', '样品配方2') IS NULL ALTER TABLE rd_filter_eff_head ADD [样品配方2] nvarchar(1000) NULL;
IF COL_LENGTH('rd_filter_eff_head', '样品配方3') IS NULL ALTER TABLE rd_filter_eff_head ADD [样品配方3] nvarchar(1000) NULL;
IF COL_LENGTH('rd_filter_eff_head', '样品配方4') IS NULL ALTER TABLE rd_filter_eff_head ADD [样品配方4] nvarchar(1000) NULL;
IF COL_LENGTH('rd_filter_eff_head', '样品配方5') IS NULL ALTER TABLE rd_filter_eff_head ADD [样品配方5] nvarchar(1000) NULL;
IF COL_LENGTH('rd_filter_eff_head', '样品配方6') IS NULL ALTER TABLE rd_filter_eff_head ADD [样品配方6] nvarchar(1000) NULL;
END TRY BEGIN CATCH PRINT '头表加列跳过(无 DDL 权限)'; END CATCH;
GO

-- ═══ 2. 中文注明(AGENTS:改表鼓励补注;幂等) ═══
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.columns c
    ON c.object_id = ep.major_id AND c.column_id = ep.minor_id
    WHERE ep.major_id = OBJECT_ID('rd_filter_eff_head') AND c.name = N'样品配方1' AND ep.name = 'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'样品1 的配方(每样品一格,列数跟「样品数」走;减列时清空该列)', N'SCHEMA', N'dbo', N'TABLE', N'rd_filter_eff_head', N'COLUMN', N'样品配方1';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.columns c
    ON c.object_id = ep.major_id AND c.column_id = ep.minor_id
    WHERE ep.major_id = OBJECT_ID('rd_filter_eff_head') AND c.name = N'样品配方2' AND ep.name = 'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'样品2 的配方(每样品一格,列数跟「样品数」走;减列时清空该列)', N'SCHEMA', N'dbo', N'TABLE', N'rd_filter_eff_head', N'COLUMN', N'样品配方2';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.columns c
    ON c.object_id = ep.major_id AND c.column_id = ep.minor_id
    WHERE ep.major_id = OBJECT_ID('rd_filter_eff_head') AND c.name = N'样品配方3' AND ep.name = 'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'样品3 的配方(每样品一格,列数跟「样品数」走;减列时清空该列)', N'SCHEMA', N'dbo', N'TABLE', N'rd_filter_eff_head', N'COLUMN', N'样品配方3';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.columns c
    ON c.object_id = ep.major_id AND c.column_id = ep.minor_id
    WHERE ep.major_id = OBJECT_ID('rd_filter_eff_head') AND c.name = N'样品配方4' AND ep.name = 'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'样品4 的配方(每样品一格,列数跟「样品数」走;减列时清空该列)', N'SCHEMA', N'dbo', N'TABLE', N'rd_filter_eff_head', N'COLUMN', N'样品配方4';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.columns c
    ON c.object_id = ep.major_id AND c.column_id = ep.minor_id
    WHERE ep.major_id = OBJECT_ID('rd_filter_eff_head') AND c.name = N'样品配方5' AND ep.name = 'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'样品5 的配方(每样品一格,列数跟「样品数」走;减列时清空该列)', N'SCHEMA', N'dbo', N'TABLE', N'rd_filter_eff_head', N'COLUMN', N'样品配方5';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.columns c
    ON c.object_id = ep.major_id AND c.column_id = ep.minor_id
    WHERE ep.major_id = OBJECT_ID('rd_filter_eff_head') AND c.name = N'样品配方6' AND ep.name = 'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'样品6 的配方(每样品一格,列数跟「样品数」走;减列时清空该列)', N'SCHEMA', N'dbo', N'TABLE', N'rd_filter_eff_head', N'COLUMN', N'样品配方6';
GO

-- ═══ 3. 存量兜底:旧单字段 样品配方 的值搬到 样品配方1(仅当配方1 为空时;本机 0 行) ═══
UPDATE rd_filter_eff_head
   SET [样品配方1] = [样品配方]
 WHERE ISNULL([样品配方], N'') <> N'' AND ISNULL([样品配方1], N'') = N'';
GO

-- ═══ 4. yj_field 注册(header;seq 接在 样品配方(110)/样品数(111) 之后,宽度同 样品信息N=150) ═══
INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
SELECT * FROM (VALUES
  ('RD_FILTER_EFF', N'样品配方1', N'样品配方1', N'文本', N'header', 112, 150, 1, 0, 0, 1),
  ('RD_FILTER_EFF', N'样品配方2', N'样品配方2', N'文本', N'header', 113, 150, 1, 0, 0, 1),
  ('RD_FILTER_EFF', N'样品配方3', N'样品配方3', N'文本', N'header', 114, 150, 1, 0, 0, 1),
  ('RD_FILTER_EFF', N'样品配方4', N'样品配方4', N'文本', N'header', 115, 150, 1, 0, 0, 1),
  ('RD_FILTER_EFF', N'样品配方5', N'样品配方5', N'文本', N'header', 116, 150, 1, 0, 0, 1),
  ('RD_FILTER_EFF', N'样品配方6', N'样品配方6', N'文本', N'header', 117, 150, 1, 0, 0, 1)
) AS v(panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
WHERE NOT EXISTS (SELECT 1 FROM yj_field f WHERE f.panel_code=v.panel_code AND f.col_name=v.col_name AND f.place=v.place);
GO

-- ═══ 5. 译名(en,至少;其余语言由机翻兜底写回 yj_translation) ═══
INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT * FROM (VALUES
  ('field', N'样品配方1', 'en', N'Sample Formula 1', 'manual'),
  ('field', N'样品配方2', 'en', N'Sample Formula 2', 'manual'),
  ('field', N'样品配方3', 'en', N'Sample Formula 3', 'manual'),
  ('field', N'样品配方4', 'en', N'Sample Formula 4', 'manual'),
  ('field', N'样品配方5', 'en', N'Sample Formula 5', 'manual'),
  ('field', N'样品配方6', 'en', N'Sample Formula 6', 'manual')
) AS v(scope, ref_key, locale, text, source)
WHERE NOT EXISTS (SELECT 1 FROM yj_translation t WHERE t.scope=v.scope AND t.ref_key=v.ref_key AND t.locale=v.locale);
GO

DECLARE @c int = (SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID('rd_filter_eff_head') AND name LIKE N'样品配方_');
DECLARE @f int = (SELECT COUNT(*) FROM yj_field WHERE panel_code='RD_FILTER_EFF' AND col_name LIKE N'样品配方_');
PRINT N'功能性滤效 样品配方 每样品一格:物理列 ' + CAST(@c AS nvarchar(10)) + N'/6,字段登记 ' + CAST(@f AS nvarchar(10)) + N'/6';
GO
