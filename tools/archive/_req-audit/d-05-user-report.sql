SET NOCOUNT ON;
-- d-05 用户/角色/账号类型(C3 供应商账号)
SELECT COUNT(*) AS 用户数 FROM yj_user;
GO
SELECT c.name AS 列名, ty.name AS 类型, c.max_length AS 长度 FROM sys.columns c
JOIN sys.types ty ON ty.user_type_id=c.user_type_id WHERE c.object_id=OBJECT_ID('yj_user') ORDER BY c.column_id;
GO
SELECT * FROM yj_user ORDER BY id;
GO
SELECT * FROM yj_role ORDER BY id;
GO
SELECT * FROM yj_role_panel ORDER BY id;
GO
-- d-05b 报表模板(ADR-0002 / C2 采购单二维码报表 / C8 特采单报表 / C9 退回单报表)
SELECT COUNT(*) AS 报表模板数 FROM yj_report_template;
GO
SELECT template_code, panel_code, name, enabled, LEN(jrxml_text) AS jrxml长度 FROM yj_report_template ORDER BY panel_code, template_code;
GO
-- d-05c 面板配置里的报表/打印旗标
SELECT panel_code, panel_name, config FROM yj_panel
WHERE panel_code IN (N'PU_ORDER',N'QC_TC',N'QC_RETURN',N'QC_RECV',N'QC_INSP',N'INV');
GO
