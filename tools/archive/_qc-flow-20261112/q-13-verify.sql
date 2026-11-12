SET NOCOUNT ON;
SELECT N'QC_FLOW 授权' AS k, COUNT(*) AS v FROM yj_role_panel WHERE panel_code = N'QC_FLOW'
UNION ALL SELECT N'QC_FLOW 译名', COUNT(*) FROM yj_translation WHERE scope='panel' AND ref_key = N'品质流程监控'
UNION ALL SELECT N'QC_FLOW 面板行(应为0)', COUNT(*) FROM yj_panel WHERE panel_code = N'QC_FLOW';
SELECT panel_code, perms, can_approve FROM yj_role_panel WHERE panel_code = N'QC_FLOW';
SELECT locale, text FROM yj_translation WHERE scope='panel' AND ref_key = N'品质流程监控' ORDER BY locale;
