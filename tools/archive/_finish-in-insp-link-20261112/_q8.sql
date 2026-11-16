SELECT 'ASM' AS kind, 单据编号, 工单号, 工单行号, 产品编码, 批次号 FROM qc_asm_insp_head WHERE ISNULL(工单号,N'')<>N'' AND 单据编号 IN (N'ZJ-2026-10-0135');
SELECT 'PROC' AS kind, 单据编号, 工单号, 工单行号, 产品编码 FROM qc_proc_insp_head WHERE 工单号 = (SELECT TOP 1 工单号 FROM qc_asm_insp_head WHERE 单据编号=N'ZJ-2026-10-0135');
SELECT COUNT(*) AS asm_draft_rows FROM qc_asm_insp_detail d WHERE d.单据编号=N'ZJ-2026-10-0135' AND ISNULL(d.asp_cancel,'N')<>'Y';
