SET NOCOUNT ON;
PRINT '=== A. qc_tc_in ===';
SELECT id, 单据编号, 单据日期, 采购单号, 单据状态, 审核人, 审批人 FROM qc_tc_in ORDER BY id;
GO
PRINT '=== B. s_allno lb=TCI ===';
SELECT id, comm, dh, lb, ny, asp_user1 FROM s_allno WHERE lb='TCI' ORDER BY id;
GO
PRINT '=== C. 审批流表里 QC_TC_IN 的行 ===';
SELECT COUNT(*) AS doc_status_rows FROM yj_doc_status WHERE panel_code='QC_TC_IN';
GO
SELECT COUNT(*) AS form_approval_rows FROM yj_form_approval WHERE panel_code='QC_TC_IN';
GO
