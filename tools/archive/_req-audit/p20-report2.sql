SET NOCOUNT ON;
SELECT N'R0: yj_report_template 是否存在' AS sec, OBJECT_ID('yj_report_template') AS oid;
GO
SELECT N'R0b: yj_report_template 列' AS sec, COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='yj_report_template' ORDER BY ORDINAL_POSITION;
GO
SELECT N'R1: yj_report_template 行' AS sec, * FROM yj_report_template;
GO
SELECT N'R3: 面板名含汇总' AS sec, panel_code, panel_name, module_group FROM yj_panel WHERE panel_name LIKE N'%汇总%';
GO
SELECT N'R4: 面板总数' AS sec, COUNT(*) AS n FROM yj_panel;
