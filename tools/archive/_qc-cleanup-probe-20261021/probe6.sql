SET NOCOUNT ON;
SELECT '=== yj_panel columns ===' AS x;
SELECT c.name, ty.name typ FROM sys.columns c JOIN sys.types ty ON ty.user_type_id=c.user_type_id WHERE c.object_id=OBJECT_ID('yj_panel') ORDER BY c.column_id;
GO
SELECT '=== yj_field columns ===' AS x;
SELECT c.name, ty.name typ FROM sys.columns c JOIN sys.types ty ON ty.user_type_id=c.user_type_id WHERE c.object_id=OBJECT_ID('yj_field') ORDER BY c.column_id;
GO
SELECT '=== panels raw ===' AS x;
SELECT * FROM yj_panel WHERE panel_code IN ('QC_INSP','QC_CATALOG','QC_INSP_REC','QC_RETURN','QC_RECV');
GO
SELECT '=== status audited examples ===' AS x;
SELECT * FROM yj_doc_status WHERE panel_code='QC_INSP' AND doc_no IN ('IJ-2026-10-0002','IJ-2026-10-0004');
GO
SELECT '=== approval rows all ===' AS x;
SELECT * FROM yj_doc_approval WHERE doc_no IN ('IJ-2026-10-0002','IJ-2026-10-0004');
GO
SELECT '=== purchase in from insp ===' AS x;
SELECT DISTINCT l.target_form_no, ds.shr, ds.canceled, ds.saved FROM form_flow_link l LEFT JOIN yj_doc_status ds ON ds.panel_code='PURCHASE_IN' AND ds.doc_no=l.target_form_no WHERE l.source_panel_code='QC_INSP' AND l.target_panel_code='PURCHASE_IN' AND l.link_status='ACTIVE' ORDER BY 1;
GO
