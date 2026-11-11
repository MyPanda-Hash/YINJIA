SET NOCOUNT ON;
SELECT panel_code, role_id, can_approve, perms FROM yj_role_panel
WHERE panel_code IN (N'QC_INSP_REC', N'QC_INSP_REC_DETAIL') ORDER BY panel_code, role_id;
SELECT id, role_code, role_name FROM yj_role ORDER BY id;
