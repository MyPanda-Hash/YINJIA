SET NOCOUNT ON;
SELECT 单据编号, 检验员, 总结论, 审核人, 审核时间, 审批人, 审批时间 FROM qc_first_insp_head WHERE 单据编号='SJ-2026-11-0013';
PRINT '--- status';
SELECT doc_no, shr, shsj, archived, pending, approve_node, l2_approver FROM yj_doc_status WHERE doc_no='SJ-2026-11-0013';
PRINT '--- trail';
SELECT action, result, node_no, operator, opinion FROM yj_form_approval WHERE form_no='SJ-2026-11-0013' ORDER BY id;
