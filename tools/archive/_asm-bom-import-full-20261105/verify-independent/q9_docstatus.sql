SET NOCOUNT ON;
SELECT panel_code, doc_no, saved, canceled FROM yj_doc_status WHERE doc_no IN (N'BOM-2026-10-0001', N'BOM-2026-11-0001');
GO
SELECT COUNT(*) AS asm_bom_status_rows FROM yj_doc_status WHERE panel_code = 'ASM_BOM';
GO
SELECT COUNT(DISTINCT 单据编号) AS plain_docs FROM dbo.bs_asm_bom WHERE ISNULL(asp_cancel,'N') <> 'Y';
GO
