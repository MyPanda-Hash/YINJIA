SELECT c.name AS col, t.name AS typ, c.max_length FROM sys.columns c JOIN sys.types t ON c.user_type_id=t.user_type_id WHERE c.object_id=OBJECT_ID('qc_asm_insp_head') ORDER BY c.column_id;
SELECT COUNT(*) AS n FROM qc_asm_insp_detail;
SELECT c.name AS col FROM sys.columns c WHERE c.object_id=OBJECT_ID('qc_asm_insp_detail') ORDER BY c.column_id;
