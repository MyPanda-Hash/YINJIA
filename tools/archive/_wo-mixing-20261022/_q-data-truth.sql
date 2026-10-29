SET NOCOUNT ON;
SELECT DB_NAME() AS 库, 'wo_mixing_list' AS 对象, COUNT(*) AS 行数 FROM dbo.wo_mixing_list;
SELECT CAST(ep.value AS nvarchar(300)) AS 表注明 FROM sys.extended_properties ep
 WHERE ep.major_id = OBJECT_ID(N'dbo.wo_mixing_list') AND ep.minor_id = 0 AND ep.name = N'MS_Description';
SELECT TOP 5 混料报工单号, 工单号, 物料编号, 物料名称, 操作人 FROM dbo.wo_mixing_list ORDER BY id;
