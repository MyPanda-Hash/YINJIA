SET NOCOUNT ON;
SELECT '=== qc_insp_rec_detail columns ===' AS x;
SELECT c.name, ty.name typ, c.max_length, c.precision, c.scale, c.is_nullable
FROM sys.columns c JOIN sys.types ty ON ty.user_type_id=c.user_type_id
WHERE c.object_id=OBJECT_ID('qc_insp_rec_detail') ORDER BY c.column_id;
GO
SELECT '=== qc_insp_rec_detail rows ===' AS x;
SELECT * FROM qc_insp_rec_detail ORDER BY id;
GO
SELECT '=== qc_insp_req ===' AS x;
SELECT * FROM qc_insp_req;
GO
SELECT '=== qc_insp_req cols ===' AS x;
SELECT c.name, ty.name typ, c.max_length FROM sys.columns c JOIN sys.types ty ON ty.user_type_id=c.user_type_id WHERE c.object_id=OBJECT_ID('qc_insp_req') ORDER BY c.column_id;
GO
SELECT '=== qc_insp_req_series ===' AS x;
SELECT * FROM qc_insp_req_series;
GO
SELECT '=== yj_field QC_INSP_REC ===' AS x;
SELECT id,label,col_name,place,seq,data_type,editable,required,visible,hidden,ref_panel,ref_field,dict_code,dict_sql
FROM yj_field WHERE panel_code='QC_INSP_REC' ORDER BY place,seq,id;
GO
SELECT '=== yj_field QC_INSP_REC detail all ===' AS x;
SELECT * FROM yj_field WHERE panel_code='QC_INSP_REC' ORDER BY place,seq,id;
GO
SELECT '=== yj_field QC_CATALOG detail all ===' AS x;
SELECT * FROM yj_field WHERE panel_code='QC_CATALOG' ORDER BY place,seq,id;
GO
SELECT '=== qc_insp approval sample ===' AS x;
SELECT * FROM yj_doc_approval WHERE panel_code='QC_INSP' ORDER BY doc_no;
GO
SELECT '=== approval columns ===' AS x;
SELECT c.name, ty.name typ FROM sys.columns c JOIN sys.types ty ON ty.user_type_id=c.user_type_id WHERE c.object_id=OBJECT_ID('yj_doc_approval') ORDER BY c.column_id;
GO
