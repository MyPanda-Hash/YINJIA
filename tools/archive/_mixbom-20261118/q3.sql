SELECT c.name, t.name typ FROM sys.columns c JOIN sys.types t ON c.user_type_id=t.user_type_id WHERE c.object_id=OBJECT_ID('yj_doc_status') ORDER BY c.column_id;
SELECT TOP 5 * FROM yj_doc_status WHERE panel_code='ASM_BOM';
SELECT 状态, COUNT(*) FROM yj_doc_status WHERE panel_code='ASM_BOM' GROUP BY 状态;
SELECT TOP 3 * FROM bs_asm_bom
