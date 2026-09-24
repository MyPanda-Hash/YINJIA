SET NOCOUNT ON;
SELECT 'status_QC_RECV' AS k, COUNT(*) AS n FROM HSDZ_MES_RESTORE.dbo.yj_doc_status WHERE panel_code='QC_RECV'
UNION ALL SELECT 'status_SL_RECV', COUNT(*) FROM HSDZ_MES_RESTORE.dbo.yj_doc_status WHERE panel_code='SL_RECV'
UNION ALL SELECT 'link_src_QC', COUNT(*) FROM HSDZ_MES_RESTORE.dbo.form_flow_link WHERE source_panel_code='QC_RECV'
UNION ALL SELECT 'link_src_SL', COUNT(*) FROM HSDZ_MES_RESTORE.dbo.form_flow_link WHERE source_panel_code='SL_RECV'
UNION ALL SELECT 'link_tgt_QC', COUNT(*) FROM HSDZ_MES_RESTORE.dbo.form_flow_link WHERE target_panel_code='QC_RECV'
UNION ALL SELECT 'link_tgt_SL', COUNT(*) FROM HSDZ_MES_RESTORE.dbo.form_flow_link WHERE target_panel_code='SL_RECV'
UNION ALL SELECT 'role_QC', COUNT(*) FROM HSDZ_MES_RESTORE.dbo.yj_role_panel WHERE panel_code='QC_RECV'
UNION ALL SELECT 'role_SL', COUNT(*) FROM HSDZ_MES_RESTORE.dbo.yj_role_panel WHERE panel_code='SL_RECV'
UNION ALL SELECT 'appr_QC', COUNT(*) FROM HSDZ_MES_RESTORE.dbo.yj_form_approval WHERE panel_code='QC_RECV'
UNION ALL SELECT 'batch_src_QC', COUNT(*) FROM HSDZ_MES_RESTORE.dbo.yj_doc_batch WHERE source_panel_code='QC_RECV';
GO
