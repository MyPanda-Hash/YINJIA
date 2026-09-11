-- migrate-filter-eff-samples.sql — 功能性滤效(RD_FILTER_EFF)动态样品列地基:
-- 样品列上限 6(默认 2):头表/明细表预置 样品3~6 物理列 + 「样品数」计数字段,前端按 样品数 渲染列数,
-- 总表宽恒定(列宽=组总宽÷列数)。减列清空该列数据(用户口径)。
-- 幂等:可重复执行。运行(UTF-8 无 BOM): SqlRunner / sqlcmd -f 65001
USE HSDZ_MES;
SET NOCOUNT ON;
GO
-- ═══ 1. 头表加列 ═══
BEGIN TRY
IF COL_LENGTH('rd_filter_eff_head', '样品数') IS NULL ALTER TABLE rd_filter_eff_head ADD [样品数] nvarchar(10) NULL;
IF COL_LENGTH('rd_filter_eff_head', '样品信息3') IS NULL ALTER TABLE rd_filter_eff_head ADD [样品信息3] nvarchar(1000) NULL;
IF COL_LENGTH('rd_filter_eff_head', '样品信息4') IS NULL ALTER TABLE rd_filter_eff_head ADD [样品信息4] nvarchar(1000) NULL;
IF COL_LENGTH('rd_filter_eff_head', '样品信息5') IS NULL ALTER TABLE rd_filter_eff_head ADD [样品信息5] nvarchar(1000) NULL;
IF COL_LENGTH('rd_filter_eff_head', '样品信息6') IS NULL ALTER TABLE rd_filter_eff_head ADD [样品信息6] nvarchar(1000) NULL;
IF COL_LENGTH('rd_filter_eff_head', '测试装置及编号3') IS NULL ALTER TABLE rd_filter_eff_head ADD [测试装置及编号3] nvarchar(200) NULL;
IF COL_LENGTH('rd_filter_eff_head', '测试装置及编号4') IS NULL ALTER TABLE rd_filter_eff_head ADD [测试装置及编号4] nvarchar(200) NULL;
IF COL_LENGTH('rd_filter_eff_head', '测试装置及编号5') IS NULL ALTER TABLE rd_filter_eff_head ADD [测试装置及编号5] nvarchar(200) NULL;
IF COL_LENGTH('rd_filter_eff_head', '测试装置及编号6') IS NULL ALTER TABLE rd_filter_eff_head ADD [测试装置及编号6] nvarchar(200) NULL;
END TRY BEGIN CATCH PRINT '头表加列跳过(无 DDL 权限)'; END CATCH;
GO
-- ═══ 2. 明细表加列(压力/流速/出水/去除率 × 样品3~6) ═══
BEGIN TRY
IF COL_LENGTH('rd_filter_eff_detail', '压力（PSI)样品3') IS NULL ALTER TABLE rd_filter_eff_detail ADD [压力（PSI)样品3] nvarchar(500) NULL;
IF COL_LENGTH('rd_filter_eff_detail', '压力（PSI)样品4') IS NULL ALTER TABLE rd_filter_eff_detail ADD [压力（PSI)样品4] nvarchar(500) NULL;
IF COL_LENGTH('rd_filter_eff_detail', '压力（PSI)样品5') IS NULL ALTER TABLE rd_filter_eff_detail ADD [压力（PSI)样品5] nvarchar(500) NULL;
IF COL_LENGTH('rd_filter_eff_detail', '压力（PSI)样品6') IS NULL ALTER TABLE rd_filter_eff_detail ADD [压力（PSI)样品6] nvarchar(500) NULL;
IF COL_LENGTH('rd_filter_eff_detail', '流速（L/min)样品3') IS NULL ALTER TABLE rd_filter_eff_detail ADD [流速（L/min)样品3] nvarchar(500) NULL;
IF COL_LENGTH('rd_filter_eff_detail', '流速（L/min)样品4') IS NULL ALTER TABLE rd_filter_eff_detail ADD [流速（L/min)样品4] nvarchar(500) NULL;
IF COL_LENGTH('rd_filter_eff_detail', '流速（L/min)样品5') IS NULL ALTER TABLE rd_filter_eff_detail ADD [流速（L/min)样品5] nvarchar(500) NULL;
IF COL_LENGTH('rd_filter_eff_detail', '流速（L/min)样品6') IS NULL ALTER TABLE rd_filter_eff_detail ADD [流速（L/min)样品6] nvarchar(500) NULL;
IF COL_LENGTH('rd_filter_eff_detail', '出水含量（ug/L）样品3') IS NULL ALTER TABLE rd_filter_eff_detail ADD [出水含量（ug/L）样品3] nvarchar(500) NULL;
IF COL_LENGTH('rd_filter_eff_detail', '出水含量（ug/L）样品4') IS NULL ALTER TABLE rd_filter_eff_detail ADD [出水含量（ug/L）样品4] nvarchar(500) NULL;
IF COL_LENGTH('rd_filter_eff_detail', '出水含量（ug/L）样品5') IS NULL ALTER TABLE rd_filter_eff_detail ADD [出水含量（ug/L）样品5] nvarchar(500) NULL;
IF COL_LENGTH('rd_filter_eff_detail', '出水含量（ug/L）样品6') IS NULL ALTER TABLE rd_filter_eff_detail ADD [出水含量（ug/L）样品6] nvarchar(500) NULL;
IF COL_LENGTH('rd_filter_eff_detail', '去除率%样品3') IS NULL ALTER TABLE rd_filter_eff_detail ADD [去除率%样品3] nvarchar(500) NULL;
IF COL_LENGTH('rd_filter_eff_detail', '去除率%样品4') IS NULL ALTER TABLE rd_filter_eff_detail ADD [去除率%样品4] nvarchar(500) NULL;
IF COL_LENGTH('rd_filter_eff_detail', '去除率%样品5') IS NULL ALTER TABLE rd_filter_eff_detail ADD [去除率%样品5] nvarchar(500) NULL;
IF COL_LENGTH('rd_filter_eff_detail', '去除率%样品6') IS NULL ALTER TABLE rd_filter_eff_detail ADD [去除率%样品6] nvarchar(500) NULL;
END TRY BEGIN CATCH PRINT '明细表加列跳过(无 DDL 权限)'; END CATCH;
GO
-- ═══ 3. yj_field 注册(头:样品数/样品信息3-6/测试装置及编号3-6;明细:16 列) ═══
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_FILTER_EFF' AND col_name=N'样品数' AND place=N'header') INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('RD_FILTER_EFF', N'样品数', N'样品数', N'文本', N'header', 111, 60, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_FILTER_EFF' AND col_name=N'样品信息3' AND place=N'header') INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('RD_FILTER_EFF', N'样品信息3', N'样品信息3', N'文本', N'header', 131, 150, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_FILTER_EFF' AND col_name=N'样品信息4' AND place=N'header') INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('RD_FILTER_EFF', N'样品信息4', N'样品信息4', N'文本', N'header', 132, 150, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_FILTER_EFF' AND col_name=N'样品信息5' AND place=N'header') INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('RD_FILTER_EFF', N'样品信息5', N'样品信息5', N'文本', N'header', 133, 150, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_FILTER_EFF' AND col_name=N'样品信息6' AND place=N'header') INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('RD_FILTER_EFF', N'样品信息6', N'样品信息6', N'文本', N'header', 134, 150, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_FILTER_EFF' AND col_name=N'测试装置及编号3' AND place=N'header') INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('RD_FILTER_EFF', N'测试装置及编号3', N'测试装置及编号3', N'文本', N'header', 191, 150, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_FILTER_EFF' AND col_name=N'测试装置及编号4' AND place=N'header') INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('RD_FILTER_EFF', N'测试装置及编号4', N'测试装置及编号4', N'文本', N'header', 192, 150, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_FILTER_EFF' AND col_name=N'测试装置及编号5' AND place=N'header') INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('RD_FILTER_EFF', N'测试装置及编号5', N'测试装置及编号5', N'文本', N'header', 193, 150, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_FILTER_EFF' AND col_name=N'测试装置及编号6' AND place=N'header') INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('RD_FILTER_EFF', N'测试装置及编号6', N'测试装置及编号6', N'文本', N'header', 194, 150, 1, 0, 0, 1);
GO
INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
SELECT * FROM (VALUES
  ('RD_FILTER_EFF', N'压力（PSI)样品3', N'压力（PSI)样品3', N'文本', N'detail', 45, 90, 1, 0, 0, 1),
  ('RD_FILTER_EFF', N'压力（PSI)样品4', N'压力（PSI)样品4', N'文本', N'detail', 46, 90, 1, 0, 0, 1),
  ('RD_FILTER_EFF', N'压力（PSI)样品5', N'压力（PSI)样品5', N'文本', N'detail', 47, 90, 1, 0, 0, 1),
  ('RD_FILTER_EFF', N'压力（PSI)样品6', N'压力（PSI)样品6', N'文本', N'detail', 48, 90, 1, 0, 0, 1),
  ('RD_FILTER_EFF', N'流速（L/min)样品3', N'流速（L/min)样品3', N'文本', N'detail', 65, 90, 1, 0, 0, 1),
  ('RD_FILTER_EFF', N'流速（L/min)样品4', N'流速（L/min)样品4', N'文本', N'detail', 66, 90, 1, 0, 0, 1),
  ('RD_FILTER_EFF', N'流速（L/min)样品5', N'流速（L/min)样品5', N'文本', N'detail', 67, 90, 1, 0, 0, 1),
  ('RD_FILTER_EFF', N'流速（L/min)样品6', N'流速（L/min)样品6', N'文本', N'detail', 68, 90, 1, 0, 0, 1),
  ('RD_FILTER_EFF', N'出水含量（ug/L）样品3', N'出水含量（ug/L）样品3', N'文本', N'detail', 85, 90, 1, 0, 0, 1),
  ('RD_FILTER_EFF', N'出水含量（ug/L）样品4', N'出水含量（ug/L）样品4', N'文本', N'detail', 86, 90, 1, 0, 0, 1),
  ('RD_FILTER_EFF', N'出水含量（ug/L）样品5', N'出水含量（ug/L）样品5', N'文本', N'detail', 87, 90, 1, 0, 0, 1),
  ('RD_FILTER_EFF', N'出水含量（ug/L）样品6', N'出水含量（ug/L）样品6', N'文本', N'detail', 88, 90, 1, 0, 0, 1),
  ('RD_FILTER_EFF', N'去除率%样品3', N'去除率%样品3', N'文本', N'detail', 105, 90, 1, 0, 0, 1),
  ('RD_FILTER_EFF', N'去除率%样品4', N'去除率%样品4', N'文本', N'detail', 106, 90, 1, 0, 0, 1),
  ('RD_FILTER_EFF', N'去除率%样品5', N'去除率%样品5', N'文本', N'detail', 107, 90, 1, 0, 0, 1),
  ('RD_FILTER_EFF', N'去除率%样品6', N'去除率%样品6', N'文本', N'detail', 108, 90, 1, 0, 0, 1)
) AS v(panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
WHERE NOT EXISTS (SELECT 1 FROM yj_field f WHERE f.panel_code=v.panel_code AND f.col_name=v.col_name AND f.place=v.place);
GO
-- ═══ 4. 译名(en,至少) ═══
INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT * FROM (VALUES
  ('field', N'样品数', 'en', N'Sample Count', 'manual'),
  ('field', N'样品信息3', 'en', N'Sample Info 3', 'manual'),
  ('field', N'样品信息4', 'en', N'Sample Info 4', 'manual'),
  ('field', N'样品信息5', 'en', N'Sample Info 5', 'manual'),
  ('field', N'样品信息6', 'en', N'Sample Info 6', 'manual'),
  ('field', N'测试装置及编号3', 'en', N'Device & No. 3', 'manual'),
  ('field', N'测试装置及编号4', 'en', N'Device & No. 4', 'manual'),
  ('field', N'测试装置及编号5', 'en', N'Device & No. 5', 'manual'),
  ('field', N'测试装置及编号6', 'en', N'Device & No. 6', 'manual'),
  ('field', N'压力（PSI)样品3', 'en', N'Sample 3', 'manual'),
  ('field', N'压力（PSI)样品4', 'en', N'Sample 4', 'manual'),
  ('field', N'压力（PSI)样品5', 'en', N'Sample 5', 'manual'),
  ('field', N'压力（PSI)样品6', 'en', N'Sample 6', 'manual'),
  ('field', N'流速（L/min)样品3', 'en', N'Sample 3', 'manual'),
  ('field', N'流速（L/min)样品4', 'en', N'Sample 4', 'manual'),
  ('field', N'流速（L/min)样品5', 'en', N'Sample 5', 'manual'),
  ('field', N'流速（L/min)样品6', 'en', N'Sample 6', 'manual'),
  ('field', N'出水含量（ug/L）样品3', 'en', N'Sample 3', 'manual'),
  ('field', N'出水含量（ug/L）样品4', 'en', N'Sample 4', 'manual'),
  ('field', N'出水含量（ug/L）样品5', 'en', N'Sample 5', 'manual'),
  ('field', N'出水含量（ug/L）样品6', 'en', N'Sample 6', 'manual'),
  ('field', N'去除率%样品3', 'en', N'Sample 3', 'manual'),
  ('field', N'去除率%样品4', 'en', N'Sample 4', 'manual'),
  ('field', N'去除率%样品5', 'en', N'Sample 5', 'manual'),
  ('field', N'去除率%样品6', 'en', N'Sample 6', 'manual')
) AS v(scope, ref_key, locale, text, source)
WHERE NOT EXISTS (SELECT 1 FROM yj_translation t WHERE t.scope=v.scope AND t.ref_key=v.ref_key AND t.locale=v.locale);
GO
PRINT N'功能性滤效动态样品列地基完成';
GO
