SET NOCOUNT ON;
SELECT '=== PI status ===' AS x;
SELECT doc_no,shr,shsj,canceled,saved,archived FROM yj_doc_status WHERE panel_code='PURCHASE_IN' AND doc_no IN ('PI-2026-10-0010','PI-2026-10-0015','PI-2026-10-0024','PI-2026-10-0025','PI-2026-10-0026') ORDER BY doc_no;
GO
SELECT '=== triggers on target tables ===' AS x;
SELECT t.name AS tbl, tr.name AS trg FROM sys.triggers tr JOIN sys.tables t ON t.object_id=tr.parent_id
WHERE t.name IN ('qc_insp','qc_insp_detail','qc_catalog','qc_catalog_detail','qc_insp_rec','qc_insp_rec_detail','qc_return','qc_return_detail','yj_doc_status','form_flow_link');
GO
SELECT '=== FK on target tables ===' AS x;
SELECT fk.name, OBJECT_NAME(fk.parent_object_id) child, OBJECT_NAME(fk.referenced_object_id) parent
FROM sys.foreign_keys fk WHERE OBJECT_NAME(fk.parent_object_id) IN ('qc_insp','qc_insp_detail','qc_catalog','qc_catalog_detail','qc_insp_rec','qc_insp_rec_detail','qc_return','qc_return_detail','yj_doc_status','form_flow_link');
GO
SELECT '=== unique indexes ===' AS x;
SELECT t.name tbl, i.name idx, i.is_unique, STRING_AGG(c.name, ',') cols
FROM sys.indexes i JOIN sys.tables t ON t.object_id=i.object_id
JOIN sys.index_columns ic ON ic.object_id=i.object_id AND ic.index_id=i.index_id
JOIN sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id
WHERE t.name IN ('qc_insp','qc_catalog','qc_insp_rec','qc_return','yj_doc_status','form_flow_link') AND i.is_unique=1
GROUP BY t.name,i.name,i.is_unique;
GO
