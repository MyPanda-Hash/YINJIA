SELECT r.role_code, r.role_name, p.can_view, p.can_edit, p.can_approve FROM yj_role_panel p
JOIN yj_role r ON r.role_code = p.role_code WHERE p.panel_code='QC_TC_IN'
GO
SELECT role_code, role_name FROM yj_role ORDER BY role_code
GO
SELECT panel_code, panel_name, module_group, category FROM yj_panel WHERE panel_code IN ('QC_TC_IN','QC_INSP','QC_RECV','QC_RETURN','QC_BHG','QC_BHC','QC_BHZ','QC_JJF','QC_SCP','QC_LYB','QC_SCY','PU_ORDER')
