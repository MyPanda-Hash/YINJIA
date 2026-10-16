PRINT N'=== ⑦ 表头 qc_asm_insp_head 的列 ===';
SELECT c.column_id, c.name, t.name AS type, c.max_length
FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID(N'qc_asm_insp_head') ORDER BY c.column_id;
