-- r-01:报表模板机制取证 —— 表是否存在 + 已挂模板清单
SET NOCOUNT ON;
GO
PRINT '=== [1] 含 report 的表/视图 ===';
SELECT TABLE_SCHEMA, TABLE_NAME, TABLE_TYPE
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_NAME LIKE '%report%' OR TABLE_NAME LIKE '%template%' OR TABLE_NAME LIKE '%jrxml%'
ORDER BY TABLE_NAME;
GO
PRINT '=== [2] yj_report_template 行数/清单 ===';
IF OBJECT_ID('yj_report_template') IS NULL
  SELECT 'yj_report_template 不存在' AS k;
ELSE
  SELECT template_code, panel_code, name, enabled, remark,
         LEN(jrxml_text) AS jrxml_len,
         create_by, CONVERT(varchar(19), create_at, 120) AS create_at,
         update_by, CONVERT(varchar(19), update_at, 120) AS update_at
  FROM yj_report_template ORDER BY panel_code, template_code;
GO
IF OBJECT_ID('yj_report_template') IS NULL
  PRINT '表不存在,跳过列结构';
ELSE
BEGIN
  PRINT '=== [3] yj_report_template 列结构 ===';
  SELECT c.column_id, c.name, t.name AS type, c.max_length, c.is_nullable, c.is_identity
  FROM sys.columns c JOIN sys.types t ON c.user_type_id = t.user_type_id
  WHERE c.object_id = OBJECT_ID('yj_report_template') ORDER BY c.column_id;
END
GO
