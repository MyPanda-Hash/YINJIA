-- 流程核验收尾:审批留痕(yj_form_approval)+ 头表状态/审核人
SELECT [单据编号], [单据状态], [审核人], [审批人], [编制人], asp_cancel
FROM qc_tc WHERE [单据编号] = N'TC-2026-09-0001';
SELECT node_no, action, result, operator, opinion FROM yj_form_approval
WHERE panel_code = 'QC_TC' AND form_no = N'TC-2026-09-0001' ORDER BY id;
SELECT pending, canceled, archived, shr FROM yj_doc_status
WHERE panel_code = 'QC_TC' AND doc_no = N'TC-2026-09-0001';
