SET NOCOUNT ON;
SELECT N'=== R1: yj_report_template 全部行 ===' AS sec, panel_code, template_code, LEFT(CAST(ISNULL(config,'') AS NVARCHAR(MAX)),120) AS cfg
FROM yj_report_template ORDER BY panel_code;
GO
SELECT N'=== R2: 报告模板表列 ===' AS sec, COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='yj_report_template' ORDER BY ORDINAL_POSITION;
GO
SELECT N'=== R3: yj_panel 中面板名/编码含汇总/明细/统计 的(确认无文件汇总表)' AS sec, panel_code, panel_name, module_group
FROM yj_panel WHERE (panel_name LIKE N'%汇总%' OR panel_name LIKE N'%汇总表%') ORDER BY panel_code;
GO
SELECT N'=== R4: 全部 panel_code+名称(基础/研发相关以外, 抽查是否漏)' AS sec, COUNT(*) AS n FROM yj_panel;
