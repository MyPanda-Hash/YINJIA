SET NOCOUNT ON;
PRINT N'=== C2:报表模板清单 ===';
IF OBJECT_ID('yj_report_template') IS NULL
  SELECT N'yj_report_template 不存在' AS k;
ELSE
  SELECT template_code, panel_code, name, enabled, LEN(jrxml_text) AS jrxml_len,
         CASE WHEN jrxml_text LIKE N'%qrcode%' OR jrxml_text LIKE N'%barcode%' THEN N'有码组件' ELSE N'' END AS 码组件,
         CASE WHEN jrxml_text LIKE N'%单价%' OR jrxml_text LIKE N'%金额%' THEN N'含金额' ELSE N'' END AS 金额
  FROM yj_report_template ORDER BY panel_code, template_code;
GO
PRINT N'=== C2:模板注册的 panel_code 是否存在于 yj_panel(孤儿检测) ===';
IF OBJECT_ID('yj_report_template') IS NOT NULL
  SELECT r.template_code, r.panel_code,
         CASE WHEN p.panel_code IS NULL THEN N'孤儿-面板不存在' ELSE N'有效' END AS 状态
  FROM yj_report_template r LEFT JOIN yj_panel p ON p.panel_code = r.panel_code;
GO
PRINT N'=== C2:采购订单面板已挂报表配置 ===';
SELECT * FROM yj_panel WHERE panel_code IN ('PU_ORDER');
GO
