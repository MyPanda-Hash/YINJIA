SELECT COUNT(*) active_rows FROM bs_asm_bom WHERE 单据编号='C-23-11_V0001' AND ISNULL(asp_cancel,'N')<>'Y';
SELECT COUNT(DISTINCT 单据编号) docs FROM bs_asm_bom WHERE ISNULL(asp_cancel,'N')<>'Y' AND NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code='ASM_BOM' AND s.doc_no=CAST(单据编号 AS nvarchar(100)) AND s.canceled='Y');
