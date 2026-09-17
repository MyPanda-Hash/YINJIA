SET NOCOUNT ON;
-- 找出 Java 代码在 qc_insp_detail 上引用的所有列 vs 实际列
SELECT c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('dbo.qc_insp_detail') ORDER BY c.column_id;
