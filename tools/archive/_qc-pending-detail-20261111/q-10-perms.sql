SET NOCOUNT ON;
SELECT r.panel_code, r.role_id, r.can_approve, r.perms
FROM yj_role_panel r WHERE r.panel_code = N'QC_INSP_REC' ORDER BY r.role_id;
PRINT N'=== 各面板行数对照 ===';
SELECT panel_code, COUNT(*) n FROM yj_role_panel WHERE panel_code IN (N'QC_INSP_REC', N'QC_INSP', N'QC_CATALOG', N'PU_ORDER_DETAIL') GROUP BY panel_code;
