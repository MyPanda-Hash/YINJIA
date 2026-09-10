-- migrate-rd-plan-stages.sql — 项目实施计划10阶段结构化(每阶段5字段) + 项目定级必填下拉
-- 阶段字段命名: 阶段N_计划内容 / 阶段N_计划开始 / 阶段N_计划完成 / 阶段N_实际完成 / 阶段N_责任人 (N=1~10)
SET NOCOUNT ON;
BEGIN TRY
  -- 50 列:10 阶段 × 5 字段
  DECLARE @i INT = 1, @sql NVARCHAR(MAX) = '';
  WHILE @i <= 10 BEGIN
    SET @sql = @sql
      + 'IF COL_LENGTH(''rd_plan'', ''阶段' + CAST(@i AS VARCHAR) + '_计划内容'') IS NULL ALTER TABLE rd_plan ADD [阶段' + CAST(@i AS VARCHAR) + '_计划内容] nvarchar(500) NULL;'
      + 'IF COL_LENGTH(''rd_plan'', ''阶段' + CAST(@i AS VARCHAR) + '_计划开始'') IS NULL ALTER TABLE rd_plan ADD [阶段' + CAST(@i AS VARCHAR) + '_计划开始] nvarchar(20) NULL;'
      + 'IF COL_LENGTH(''rd_plan'', ''阶段' + CAST(@i AS VARCHAR) + '_计划完成'') IS NULL ALTER TABLE rd_plan ADD [阶段' + CAST(@i AS VARCHAR) + '_计划完成] nvarchar(20) NULL;'
      + 'IF COL_LENGTH(''rd_plan'', ''阶段' + CAST(@i AS VARCHAR) + '_实际完成'') IS NULL ALTER TABLE rd_plan ADD [阶段' + CAST(@i AS VARCHAR) + '_实际完成] nvarchar(20) NULL;'
      + 'IF COL_LENGTH(''rd_plan'', ''阶段' + CAST(@i AS VARCHAR) + '_责任人'') IS NULL ALTER TABLE rd_plan ADD [阶段' + CAST(@i AS VARCHAR) + '_责任人] nvarchar(50) NULL;';
    SET @i = @i + 1;
  END
  EXEC(@sql);
END TRY
BEGIN CATCH
  PRINT '阶段列加列跳过(无 DDL 权限)';
END CATCH
GO
-- 项目定级:原为文本,改为必填下拉(二级/三级/四级)
UPDATE yj_field SET data_type = N'下拉框', required = 1,
  dict_sql = N'SELECT v FROM (VALUES (N''二级''),(N''三级''),(N''四级'')) AS t(v)'
WHERE panel_code = 'RD_PLAN' AND col_name = N'项目定级' AND (data_type <> N'下拉框' OR ISNULL(required,0) = 0);
GO
-- 50 个阶段字段的 yj_field 注册(place=header,editable=1,分批插入以控制长度)
-- 阶段1~5
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
SELECT 'RD_PLAN', N'阶段'+CAST(n.n AS VARCHAR)+N'_计划内容', N'阶段'+CAST(n.n AS VARCHAR)+N'_计划内容', N'文本', NULL, NULL, NULL, NULL, N'header', 300+n.n*10, 300, 1, 0, 1, 0 FROM (VALUES (1),(2),(3),(4),(5)) n(n)
WHERE NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_PLAN' AND col_name=N'阶段'+CAST(n.n AS VARCHAR)+N'_计划内容');
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
SELECT 'RD_PLAN', N'阶段'+CAST(n.n AS VARCHAR)+N'_计划开始', N'阶段'+CAST(n.n AS VARCHAR)+N'_计划开始', N'文本', NULL, NULL, NULL, NULL, N'header', 301+n.n*10, 120, 1, 0, 1, 0 FROM (VALUES (1),(2),(3),(4),(5)) n(n)
WHERE NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_PLAN' AND col_name=N'阶段'+CAST(n.n AS VARCHAR)+N'_计划开始');
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
SELECT 'RD_PLAN', N'阶段'+CAST(n.n AS VARCHAR)+N'_计划完成', N'阶段'+CAST(n.n AS VARCHAR)+N'_计划完成', N'文本', NULL, NULL, NULL, NULL, N'header', 302+n.n*10, 120, 1, 0, 1, 0 FROM (VALUES (1),(2),(3),(4),(5)) n(n)
WHERE NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_PLAN' AND col_name=N'阶段'+CAST(n.n AS VARCHAR)+N'_计划完成');
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
SELECT 'RD_PLAN', N'阶段'+CAST(n.n AS VARCHAR)+N'_实际完成', N'阶段'+CAST(n.n AS VARCHAR)+N'_实际完成', N'文本', NULL, NULL, NULL, NULL, N'header', 303+n.n*10, 120, 1, 0, 1, 0 FROM (VALUES (1),(2),(3),(4),(5)) n(n)
WHERE NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_PLAN' AND col_name=N'阶段'+CAST(n.n AS VARCHAR)+N'_实际完成');
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
SELECT 'RD_PLAN', N'阶段'+CAST(n.n AS VARCHAR)+N'_责任人', N'阶段'+CAST(n.n AS VARCHAR)+N'_责任人', N'文本', NULL, NULL, NULL, NULL, N'header', 304+n.n*10, 100, 1, 0, 1, 0 FROM (VALUES (1),(2),(3),(4),(5)) n(n)
WHERE NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_PLAN' AND col_name=N'阶段'+CAST(n.n AS VARCHAR)+N'_责任人');
-- 阶段6~10
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
SELECT 'RD_PLAN', N'阶段'+CAST(n.n AS VARCHAR)+N'_计划内容', N'阶段'+CAST(n.n AS VARCHAR)+N'_计划内容', N'文本', NULL, NULL, NULL, NULL, N'header', 300+n.n*10, 300, 1, 0, 1, 0 FROM (VALUES (6),(7),(8),(9),(10)) n(n)
WHERE NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_PLAN' AND col_name=N'阶段'+CAST(n.n AS VARCHAR)+N'_计划内容');
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
SELECT 'RD_PLAN', N'阶段'+CAST(n.n AS VARCHAR)+N'_计划开始', N'阶段'+CAST(n.n AS VARCHAR)+N'_计划开始', N'文本', NULL, NULL, NULL, NULL, N'header', 301+n.n*10, 120, 1, 0, 1, 0 FROM (VALUES (6),(7),(8),(9),(10)) n(n)
WHERE NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_PLAN' AND col_name=N'阶段'+CAST(n.n AS VARCHAR)+N'_计划开始');
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
SELECT 'RD_PLAN', N'阶段'+CAST(n.n AS VARCHAR)+N'_计划完成', N'阶段'+CAST(n.n AS VARCHAR)+N'_计划完成', N'文本', NULL, NULL, NULL, NULL, N'header', 302+n.n*10, 120, 1, 0, 1, 0 FROM (VALUES (6),(7),(8),(9),(10)) n(n)
WHERE NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_PLAN' AND col_name=N'阶段'+CAST(n.n AS VARCHAR)+N'_计划完成');
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
SELECT 'RD_PLAN', N'阶段'+CAST(n.n AS VARCHAR)+N'_实际完成', N'阶段'+CAST(n.n AS VARCHAR)+N'_实际完成', N'文本', NULL, NULL, NULL, NULL, N'header', 303+n.n*10, 120, 1, 0, 1, 0 FROM (VALUES (6),(7),(8),(9),(10)) n(n)
WHERE NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_PLAN' AND col_name=N'阶段'+CAST(n.n AS VARCHAR)+N'_实际完成');
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
SELECT 'RD_PLAN', N'阶段'+CAST(n.n AS VARCHAR)+N'_责任人', N'阶段'+CAST(n.n AS VARCHAR)+N'_责任人', N'文本', NULL, NULL, NULL, NULL, N'header', 304+n.n*10, 100, 1, 0, 1, 0 FROM (VALUES (6),(7),(8),(9),(10)) n(n)
WHERE NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_PLAN' AND col_name=N'阶段'+CAST(n.n AS VARCHAR)+N'_责任人');
GO
-- 阶段完成按钮:后端 ButtonService case
PRINT N'migrate-rd-plan-stages 完成(50列+50字段+项目定级必填下拉)';
GO
