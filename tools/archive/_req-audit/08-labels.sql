SET NOCOUNT ON;
PRINT '=== 研发各面板字段清单(逗号连接) ===';
SELECT p.panel_code, p.panel_name,
       STRING_AGG(CAST(f.label AS NVARCHAR(MAX)), N' | ') WITHIN GROUP (ORDER BY f.seq, f.id) AS labels
FROM yj_panel p JOIN yj_field f ON f.panel_code = p.panel_code
WHERE p.module_group = N'研发管理'
GROUP BY p.panel_code, p.panel_name
ORDER BY p.panel_code;
GO
PRINT '=== 供应链/品质/库存 关键面板字段清单 ===';
SELECT p.panel_code, p.panel_name,
       STRING_AGG(CAST(f.label AS NVARCHAR(MAX)), N' | ') WITHIN GROUP (ORDER BY f.seq, f.id) AS labels
FROM yj_panel p JOIN yj_field f ON f.panel_code = p.panel_code
WHERE p.panel_code IN ('QC_RECV','QC_RETURN','PURCHASE_IN','PU_ORDER','OTHER_IN','OTHER_OUT','INV')
GROUP BY p.panel_code, p.panel_name
ORDER BY p.panel_code;
