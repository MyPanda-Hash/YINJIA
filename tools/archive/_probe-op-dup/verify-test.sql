SET NOCOUNT ON;
SELECT DB_NAME() AS 库名;
GO
SELECT id, 工序编码, 工序名称, asp_cancel, asp_user2 FROM dbo.bs_op ORDER BY 工序编码, id;
GO
SELECT 工序编码, COUNT(*) AS 存活行数 FROM dbo.bs_op WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY 工序编码 HAVING COUNT(*)>1;
GO
SELECT c.name, c.is_nullable, dc.name AS 默认约束 FROM sys.columns c
LEFT JOIN sys.default_constraints dc ON dc.parent_object_id=c.object_id AND dc.parent_column_id=c.column_id
WHERE c.object_id=OBJECT_ID('dbo.bs_op') AND c.name='asp_cancel';
GO
SELECT i.name, i.is_unique, i.has_filter, i.filter_definition FROM sys.indexes i
WHERE i.object_id=OBJECT_ID('dbo.bs_op') AND i.name='ux_bs_op_code';
GO
SELECT panel_code, CONVERT(nvarchar(200), config) AS config FROM yj_panel WHERE panel_code='OP';
GO
SELECT script_name, applied_at FROM yj_schema_log WHERE script_name='migrate-op-code-unique-20261016.sql';
GO
