SET NOCOUNT ON;
DECLARE @wo nvarchar(60)=N'GD-TEST-FIRST-261112';
DECLARE @nos TABLE(no nvarchar(100) PRIMARY KEY);
INSERT INTO @nos SELECT 单据编号 FROM qc_first_insp_head WHERE 工单号=@wo;
INSERT INTO @nos SELECT 单据编号 FROM qc_proc_insp_head WHERE 工单号=@wo;
INSERT INTO @nos SELECT 单据编号 FROM qc_asm_insp_head WHERE 工单号=@wo;
DELETE FROM qc_first_insp_detail WHERE 单据编号 IN (SELECT no FROM @nos);
DELETE FROM qc_first_insp_head   WHERE 单据编号 IN (SELECT no FROM @nos);
DELETE FROM qc_proc_insp_detail  WHERE 单据编号 IN (SELECT no FROM @nos);
DELETE FROM qc_proc_insp_head    WHERE 单据编号 IN (SELECT no FROM @nos);
DELETE FROM qc_asm_insp_detail   WHERE 单据编号 IN (SELECT no FROM @nos);
DELETE FROM qc_asm_insp_head     WHERE 单据编号 IN (SELECT no FROM @nos);
DELETE FROM form_flow_link WHERE target_form_no IN (SELECT no FROM @nos) OR source_form_no=@wo;
DELETE FROM yj_doc_status WHERE doc_no IN (SELECT no FROM @nos);
DELETE FROM dbo.scjl WHERE gldh=@wo;
DELETE FROM dbo.wo_transfer_log WHERE pl_no=@wo;
DELETE FROM dbo.wo_process_line WHERE 工单号=@wo;
DELETE FROM dbo.wo_progress WHERE 单据编号=@wo;
DELETE FROM dbo.plang_pc WHERE plang_id IN (SELECT id FROM dbo.plang WHERE pl_no=@wo);
DELETE FROM dbo.plang WHERE pl_no=@wo;
PRINT N'== 清理后自检(全部应为 0) ==';
SELECT (SELECT COUNT(*) FROM dbo.plang WHERE pl_no=@wo) AS plang_left,
       (SELECT COUNT(*) FROM dbo.scjl WHERE gldh=@wo) AS scjl_left,
       (SELECT COUNT(*) FROM dbo.qc_first_insp_head WHERE 工单号=@wo) AS first_left,
       (SELECT COUNT(*) FROM dbo.qc_proc_insp_head WHERE 工单号=@wo) AS proc_left,
       (SELECT COUNT(*) FROM dbo.qc_asm_insp_head WHERE 工单号=@wo) AS asm_left,
       (SELECT COUNT(*) FROM dbo.form_flow_link WHERE source_form_no=@wo) AS link_left,
       (SELECT COUNT(*) FROM dbo.wo_process_line WHERE 工单号=@wo) AS ledger_left,
       (SELECT COUNT(*) FROM dbo.wo_progress WHERE 单据编号=@wo) AS progress_left,
       (SELECT COUNT(*) FROM dbo.wo_transfer_log WHERE pl_no=@wo) AS transfer_left;
