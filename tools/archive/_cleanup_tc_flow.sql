-- 清理流程核验测试单(QC_TC TC-2026-09-0001:头行+状态+审批留痕全清)
DELETE FROM qc_tc WHERE [单据编号] = N'TC-2026-09-0001';
DELETE FROM qc_tc_detail WHERE [单据编号] = N'TC-2026-09-0001';
DELETE FROM yj_doc_status WHERE panel_code = 'QC_TC' AND doc_no = N'TC-2026-09-0001';
DELETE FROM yj_form_approval WHERE panel_code = 'QC_TC' AND form_no = N'TC-2026-09-0001';
SELECT 'qc_tc' t, COUNT(*) c FROM qc_tc
UNION ALL SELECT 'doc_status', COUNT(*) FROM yj_doc_status WHERE panel_code = 'QC_TC'
UNION ALL SELECT 'form_approval', COUNT(*) FROM yj_form_approval WHERE panel_code = 'QC_TC';
