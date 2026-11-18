SELECT id, doc_no, canceled, saved, archived, pending, modify_state, deleting FROM yj_doc_status WHERE panel_code='ASM_BOM';
SELECT 单据编号, asp_cancel, 状态, COUNT(*) n, MIN(asp_time1) t1 FROM bs_asm_bom WHERE 单据编号='C-23-11_V0001' GROUP BY 单据编号, asp_cancel, 状态;
SELECT COUNT(DISTINCT 单据编号) AS visible_docs FROM bs_asm_bom t WHERE ISNULL(t.asp_cancel,'N')<>'Y' AND NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code='ASM_BOM' AND s.doc_no=CAST(t.单据编号 AS nvarchar(100)) AND s.canceled='Y');
