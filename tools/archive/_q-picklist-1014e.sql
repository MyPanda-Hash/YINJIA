-- _q-picklist-1014e.sql — 探针 v5:可用的「材料来源」(配方/工艺清单)现状(只读)
SET NOCOUNT ON;
PRINT '=== 1) 候选材料来源表行数 ===';
SELECT N'rd_mold_proc_detail' AS 表, COUNT(*) AS 行数 FROM rd_mold_proc_detail
UNION ALL SELECT N'rd_mold_proc_head', COUNT(*) FROM rd_mold_proc_head
UNION ALL SELECT N'rd_asm_proc_detail', COUNT(*) FROM rd_asm_proc_detail
UNION ALL SELECT N'rd_asm_proc_head', COUNT(*) FROM rd_asm_proc_head
UNION ALL SELECT N'rd_mold_formula_detail', COUNT(*) FROM rd_mold_formula_detail
UNION ALL SELECT N'rd_asm_bom_detail', COUNT(*) FROM rd_asm_bom_detail
UNION ALL SELECT N'mate(BOM)', COUNT(*) FROM mate;

PRINT '=== 2) 成型工艺清单行 列 ===';
SELECT c.name FROM sys.columns c WHERE c.object_id = OBJECT_ID(N'dbo.rd_mold_proc_detail') ORDER BY c.column_id;

PRINT '=== 3) 成型工艺清单 头(最近 5) ===';
SELECT TOP 5 * FROM rd_mold_proc_head ORDER BY id DESC;

PRINT '=== 4) 成型工艺清单行(最近 10) ===';
SELECT TOP 10 * FROM rd_mold_proc_detail ORDER BY id DESC;
