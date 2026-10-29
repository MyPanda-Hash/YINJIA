SET NOCOUNT ON;
DECLARE @need TABLE(col sysname);
INSERT INTO @need VALUES (N'单据编号'),(N'单据日期'),(N'工序'),(N'总结论'),(N'报工数量'),(N'检验数量'),(N'检验员'),(N'批次号'),(N'报工单号'),(N'处理方式'),(N'工单号'),(N'工单行号');
SELECT t.name AS tbl, n.col AS missing
FROM sys.tables t CROSS JOIN @need n
WHERE t.name IN ('qc_first_insp_head','qc_proc_insp_head','qc_asm_insp_head')
  AND NOT EXISTS (SELECT 1 FROM sys.columns x WHERE x.object_id=t.object_id AND x.name=n.col)
ORDER BY t.name;
PRINT '--- done (no rows above = 列齐全) ---';
