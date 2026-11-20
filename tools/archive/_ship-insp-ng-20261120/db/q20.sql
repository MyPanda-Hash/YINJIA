SET NOCOUNT ON;
SELECT COUNT(*) AS plang_rows FROM plang WHERE ISNULL(asp_cancel,'N')<>'Y';
SELECT COUNT(*) AS proc_insp_rows FROM qc_proc_insp_head;
SELECT COUNT(*) AS asm_rows FROM qc_asm_insp_head;
SELECT TOP 5 单据编号, 工单号, 总结论, 客户名称, 产品编码, 产品名称, 规格型号 FROM qc_proc_insp_head ORDER BY id DESC;
