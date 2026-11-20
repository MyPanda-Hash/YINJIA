SET NOCOUNT ON;
DECLARE @docs TABLE (no nvarchar(60));
INSERT INTO @docs VALUES (N'BHC-2026-11-0003'), (N'BHC-2026-11-0004');
SELECT 'before: qc_bhc' k, COUNT(*) c FROM qc_bhc WHERE 单据编号 IN (SELECT no FROM @docs)
UNION ALL SELECT 'before: qc_bhc_detail', COUNT(*) FROM qc_bhc_detail WHERE 单据编号 IN (SELECT no FROM @docs)
UNION ALL SELECT 'before: yj_doc_status', COUNT(*) FROM yj_doc_status WHERE panel_code='QC_BHC' AND doc_no IN (SELECT no FROM @docs)
UNION ALL SELECT 'before: yj_form_approval', COUNT(*) FROM yj_form_approval WHERE panel_code='QC_BHC' AND form_no IN (SELECT no FROM @docs)
UNION ALL SELECT 'before: yj_attachment', COUNT(*) FROM yj_attachment WHERE panel_code='QC_BHC' AND doc_no IN (SELECT no FROM @docs);
DELETE FROM yj_attachment WHERE panel_code='QC_BHC' AND doc_no IN (SELECT no FROM @docs);
DELETE FROM yj_form_approval WHERE panel_code='QC_BHC' AND form_no IN (SELECT no FROM @docs);
DELETE FROM yj_doc_status WHERE panel_code='QC_BHC' AND doc_no IN (SELECT no FROM @docs);
DELETE FROM qc_bhc_detail WHERE 单据编号 IN (SELECT no FROM @docs);
DELETE FROM qc_bhc WHERE 单据编号 IN (SELECT no FROM @docs);
UPDATE qc_proc_insp_head SET 总结论 = NULL WHERE 单据编号 = N'ZC-2026-10-0131' AND 总结论 = N'不合格';
UPDATE qc_asm_insp_head SET 总结论 = NULL WHERE 单据编号 = N'ZJ-2026-11-0007' AND 总结论 = N'不合格';
SELECT 'after: qc_bhc' k, COUNT(*) c FROM qc_bhc WHERE 单据编号 IN (SELECT no FROM @docs)
UNION ALL SELECT 'after: qc_bhc_detail', COUNT(*) FROM qc_bhc_detail WHERE 单据编号 IN (SELECT no FROM @docs)
UNION ALL SELECT 'after: yj_doc_status', COUNT(*) FROM yj_doc_status WHERE panel_code='QC_BHC' AND doc_no IN (SELECT no FROM @docs)
UNION ALL SELECT 'revert: ZC verdict', COUNT(*) FROM qc_proc_insp_head WHERE 单据编号=N'ZC-2026-10-0131' AND 总结论=N'不合格'
UNION ALL SELECT 'revert: ZJ verdict', COUNT(*) FROM qc_asm_insp_head WHERE 单据编号=N'ZJ-2026-11-0007' AND 总结论=N'不合格';
