SET NOCOUNT ON;
PRINT '--- before: rows per table';
SELECT 'head' t, COUNT(*) c FROM qc_first_insp_head WHERE 单据编号 IN ('SJ-2026-11-0012','SJ-2026-11-0013')
UNION ALL SELECT 'detail', COUNT(*) FROM qc_first_insp_detail WHERE 单据编号 IN ('SJ-2026-11-0012','SJ-2026-11-0013')
UNION ALL SELECT 'status', COUNT(*) FROM yj_doc_status WHERE doc_no IN ('SJ-2026-11-0012','SJ-2026-11-0013')
UNION ALL SELECT 'trail', COUNT(*) FROM yj_form_approval WHERE form_no IN ('SJ-2026-11-0012','SJ-2026-11-0013')
UNION ALL SELECT 'flowlink', COUNT(*) FROM form_flow_link WHERE target_form_no IN ('SJ-2026-11-0012','SJ-2026-11-0013')
UNION ALL SELECT 'annot', COUNT(*) FROM yj_doc_annotation WHERE doc_no IN ('SJ-2026-11-0012','SJ-2026-11-0013');
DELETE FROM qc_first_insp_detail WHERE 单据编号 IN ('SJ-2026-11-0012','SJ-2026-11-0013');
DELETE FROM qc_first_insp_head WHERE 单据编号 IN ('SJ-2026-11-0012','SJ-2026-11-0013');
DELETE FROM yj_form_approval WHERE form_no IN ('SJ-2026-11-0012','SJ-2026-11-0013');
DELETE FROM yj_doc_annotation WHERE doc_no IN ('SJ-2026-11-0012','SJ-2026-11-0013');
DELETE FROM yj_doc_status WHERE doc_no IN ('SJ-2026-11-0012','SJ-2026-11-0013');
UPDATE form_flow_link SET link_status='RELEASED', release_time=SYSDATETIME()
 WHERE target_form_no IN ('SJ-2026-11-0012','SJ-2026-11-0013') AND link_status='ACTIVE';
PRINT '--- after: rows per table';
SELECT 'head' t, COUNT(*) c FROM qc_first_insp_head WHERE 单据编号 IN ('SJ-2026-11-0012','SJ-2026-11-0013')
UNION ALL SELECT 'detail', COUNT(*) FROM qc_first_insp_detail WHERE 单据编号 IN ('SJ-2026-11-0012','SJ-2026-11-0013')
UNION ALL SELECT 'status', COUNT(*) FROM yj_doc_status WHERE doc_no IN ('SJ-2026-11-0012','SJ-2026-11-0013')
UNION ALL SELECT 'trail', COUNT(*) FROM yj_form_approval WHERE form_no IN ('SJ-2026-11-0012','SJ-2026-11-0013');
