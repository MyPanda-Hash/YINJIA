SET NOCOUNT ON;
SELECT TOP 6 单据编号, 存货编码, 数量, 仓库 FROM inh WHERE 单据编号 IN ('OI-2026-10-0006','OI-2026-10-0007');
GO
SELECT c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('inh') AND (name LIKE '%单据%' OR name LIKE '%存货%' OR name LIKE '%数量%' OR name LIKE '%仓库%');
