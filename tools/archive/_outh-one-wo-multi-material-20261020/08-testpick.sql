SET NOCOUNT ON;
SELECT TOP 3 src, rid, 物料编码, 批号, 单据编号 FROM dbo.outh WHERE src = 6 AND rid IS NOT NULL ORDER BY rid;
SELECT name, has_filter, filter_definition FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.outh') AND is_unique = 1;
