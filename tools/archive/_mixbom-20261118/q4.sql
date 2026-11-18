SELECT COUNT(*) AS asm_docs FROM bs_asm_bom;
SELECT COUNT(*) AS asm_doc_status_rows FROM yj_doc_status WHERE panel_code='ASM_BOM';
SELECT TOP 8 s.doc_no, s.archived, s.saved, s.pending, s.canceled FROM yj_doc_status s WHERE panel_code='ASM_BOM' ORDER BY s.id DESC;
SELECT COUNT(*) AS asm_detail_rows FROM bs_asm_bom_item;
SELECT c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('bs_asm_bom') ORDER BY c.column_id;
SELECT c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('bs_asm_bom_item') ORDER BY c.column_id;
SELECT TOP 2 * FROM bs_asm_bom_item;
SELECT COUNT(*) mate_rows FROM mate
