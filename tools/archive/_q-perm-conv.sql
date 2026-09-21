SET NOCOUNT ON;
PRINT '=== 对比:有权限行的 doc 面板范例(取 8 个) ===';
SELECT TOP 40 r.panel_code, r.role_id, r.can_approve, r.perms
FROM yj_role_panel r
WHERE r.panel_code IN ('QC_RECV','QC_RETURN','PURCHASE_IN','SO_ORDER','WO_ORDER','QC_INSP','ROD_RETURN','SAMPLE_REQ')
ORDER BY r.panel_code, r.role_id;
GO
PRINT '=== 哪些面板有权限行(计数) ===';
SELECT TOP 15 panel_code, COUNT(*) AS n FROM yj_role_panel GROUP BY panel_code ORDER BY n DESC;
GO
