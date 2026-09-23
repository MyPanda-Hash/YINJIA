SET NOCOUNT ON;
-- 用户与角色表结构
SELECT t.name AS 表名,
       STUFF((SELECT N' | ' + CAST(c2.column_id AS varchar(4)) + N':' + c2.name
              FROM sys.columns c2 WHERE c2.object_id = t.object_id
              ORDER BY c2.column_id FOR XML PATH(''), TYPE).value('.', 'nvarchar(4000)'), 1, 3, N'') AS 列清单
FROM sys.tables t WHERE t.name IN ('yj_user','yj_role','yj_role_panel','yj_doc_status','yj_report_template','yj_std_lib')
ORDER BY t.name;
GO
SELECT TOP 20 id, account, name, role_id, dept_id FROM yj_user ORDER BY id;
GO
SELECT id, role_code, role_name FROM yj_role ORDER BY id;
GO
SELECT template_code, panel_code, template_name, file_name, enabled FROM yj_report_template ORDER BY panel_code, template_code;
GO
-- 检验相关档案面板:检验项目/检验方案
SELECT panel_code, panel_name, module_group, category, mode, line_table, head_table
FROM yj_panel
WHERE panel_code IN ('QC_ITEM','QC_PLAN','QC_ITEM_DETAIL') OR panel_name LIKE N'%检验%'
ORDER BY panel_code;
GO
SELECT panel_code, COUNT(*) AS 字段数 FROM yj_field WHERE panel_code IN ('QC_ITEM','QC_PLAN') GROUP BY panel_code;
GO
-- 检验标准库(9 大类?)yj_std_lib
SELECT TOP 30 id, lib_code, item_code, LEFT(content, 60) AS content_head FROM yj_std_lib ORDER BY id;
GO
SELECT lib_code, COUNT(*) AS 条目数 FROM yj_std_lib GROUP BY lib_code;
GO
