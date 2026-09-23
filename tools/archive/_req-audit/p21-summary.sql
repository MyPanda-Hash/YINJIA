SET NOCOUNT ON;
SELECT N'RD 表总数(前缀 rd)' AS sec, COUNT(*) AS n FROM sys.tables WHERE name LIKE 'rd%';
GO
SELECT N'RD 表按后缀分类' AS sec,
       SUM(CASE WHEN name LIKE '%[_]head' THEN 1 ELSE 0 END) AS head_tables,
       SUM(CASE WHEN name LIKE '%[_]detail' THEN 1 ELSE 0 END) AS detail_tables,
       SUM(CASE WHEN name NOT LIKE '%[_]head' AND name NOT LIKE '%[_]detail' THEN 1 ELSE 0 END) AS others
FROM sys.tables WHERE name LIKE 'rd%';
GO
SELECT N'yj_panel 研发管理面板数' AS sec, COUNT(*) AS n FROM yj_panel WHERE module_group=N'研发管理';
GO
SELECT N'yj_field 研发面板字段数合计' AS sec, COUNT(*) AS n FROM yj_field WHERE panel_code IN (SELECT panel_code FROM yj_panel WHERE module_group=N'研发管理');
GO
SELECT N'yj_user 行数' AS sec, COUNT(*) AS n FROM yj_user;
GO
SELECT N'yj_role_panel 行数' AS sec, COUNT(*) AS n FROM yj_role_panel;
GO
SELECT N'yj_form_approval 中 RD 记录数' AS sec, COUNT(*) AS n FROM yj_form_approval WHERE panel_code LIKE 'RD%';
GO
SELECT N'yj_doc_status 中 RD 记录数' AS sec, COUNT(*) AS n FROM yj_doc_status WHERE panel_code LIKE 'RD%';
GO
SELECT N'yj_plan_term 行数' AS sec, COUNT(*) AS n FROM yj_plan_term;
GO
SELECT N'rd_dev_task 行数' AS sec, COUNT(*) AS n FROM rd_dev_task;
GO
SELECT N'rd_spec_assign 行数' AS sec, COUNT(*) AS n FROM rd_spec_assign;
GO
SELECT N'yj_std_lib 按库' AS sec, lib_code, COUNT(*) AS n FROM yj_std_lib GROUP BY lib_code;
GO
SELECT N'bs_op 工序类型填充率' AS sec, COUNT(*) AS total, SUM(CASE WHEN 工序类型 IS NULL OR 工序类型='' THEN 1 ELSE 0 END) AS blank_type FROM bs_op;
