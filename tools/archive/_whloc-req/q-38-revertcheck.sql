SET NOCOUNT ON;
PRINT N'=== yj_schema_log 结构 ===';
SELECT c.name AS 列, ty.name AS 类型 FROM sys.columns c JOIN sys.types ty ON ty.user_type_id=c.user_type_id
WHERE c.object_id=OBJECT_ID('dbo.yj_schema_log') ORDER BY c.column_id;
GO
PRINT N'=== 与 zone-dict 相关的链记录 ===';
SELECT * FROM yj_schema_log WHERE script LIKE N'%zone-dict%';
GO
PRINT N'=== 当前 yj_field 两行 ===';
SELECT label AS 字段, data_type AS 类型, ISNULL(dict_sql,N'(无)') AS 字典SQL
FROM yj_field WHERE panel_code=N'WHLOC' AND label IN (N'大区',N'存储分区');
GO