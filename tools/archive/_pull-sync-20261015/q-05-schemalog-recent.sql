-- q-05-schemalog-recent.sql — yj_schema_log 结构 + 最近登记的脚本(判定四单顺序变动是否由本次同步引入)
SET NOCOUNT ON;
SELECT N'列' AS k, c.name, t.name AS 类型 FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID('yj_schema_log') ORDER BY c.column_id;
GO
SELECT TOP 15 * FROM yj_schema_log ORDER BY 1 DESC;
GO
