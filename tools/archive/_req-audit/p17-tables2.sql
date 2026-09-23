SET NOCOUNT ON;
PRINT N'=== A. 全部 rd_* 表(名称+列数+行数) ===';
SELECT t.name AS tbl, (SELECT COUNT(*) FROM sys.columns c WHERE c.object_id=t.object_id) AS cols, CAST(p.rows AS INT) AS rows_approx
FROM sys.tables t JOIN sys.partitions p ON p.object_id=t.object_id AND p.index_id IN (0,1)
WHERE t.name LIKE 'rd%' ORDER BY t.name;
GO
PRINT N'=== B. 表名含 spec/assign 的 ===';
SELECT name, type_desc FROM sys.objects WHERE name LIKE '%spec%' OR name LIKE '%assign%' ORDER BY name;
GO
PRINT N'=== C. rd_spec_doc_head 列 ===';
SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='rd_spec_doc_head' ORDER BY ORDINAL_POSITION;
GO
PRINT N'=== D. rd_spec_doc_detail 列 ===';
SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='rd_spec_doc_detail' ORDER BY ORDINAL_POSITION;
GO
PRINT N'=== E. rd_asm_proc_head / detail 列 ===';
SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME IN ('rd_asm_proc_head','rd_asm_proc_detail') ORDER BY TABLE_NAME, ORDINAL_POSITION;
GO
PRINT N'=== F. rd_insp_plan_head / detail 列 ===';
SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME IN ('rd_insp_plan_head','rd_insp_plan_detail') ORDER BY TABLE_NAME, ORDINAL_POSITION;
GO
PRINT N'=== G. rd_dom_test_head / detail 列 ===';
SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME IN ('rd_dom_test_head','rd_dom_test_detail') ORDER BY TABLE_NAME, ORDINAL_POSITION;
