SELECT COUNT(*) AS 列数 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.bd_pu_label');
SELECT c.name, TYPE_NAME(c.user_type_id) AS 类型, c.is_nullable FROM sys.columns c WHERE c.object_id = OBJECT_ID(N'dbo.bd_pu_label') ORDER BY c.column_id;
