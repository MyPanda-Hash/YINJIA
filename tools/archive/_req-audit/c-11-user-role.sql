SET NOCOUNT ON;
SELECT TOP 20 id, username, real_name, is_admin, role_id, dept_id, enabled FROM yj_user ORDER BY id;
GO
SELECT id, role_code, role_name, is_admin FROM yj_role ORDER BY id;
GO
SELECT id, role_id, panel_code, can_approve, perms FROM yj_role_panel ORDER BY role_id, panel_code;
GO
SELECT template_code, panel_code, name, enabled, LEN(jrxml_text) AS 长度 FROM yj_report_template ORDER BY panel_code, template_code;
GO
SELECT panel_code, panel_name, module_group, category, mode, line_table, head_table
FROM yj_panel
WHERE panel_code LIKE 'QC%' OR panel_name LIKE N'%检验%'
ORDER BY panel_code;
GO
SELECT panel_code, COUNT(*) AS 字段数 FROM yj_field WHERE panel_code LIKE 'QC%' GROUP BY panel_code ORDER BY panel_code;
GO
SELECT lib_code, COUNT(*) AS 条目数 FROM yj_std_lib GROUP BY lib_code;
GO
SELECT TOP 40 id, lib_code, item_code, LEFT(content, 50) AS content_head FROM yj_std_lib ORDER BY lib_code, seq;
GO
