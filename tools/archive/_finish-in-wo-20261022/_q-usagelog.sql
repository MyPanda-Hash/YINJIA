SET NOCOUNT ON;
SELECT c.name, c.is_identity, c.is_nullable, ty.name AS type, c.max_length
  FROM sys.columns c JOIN sys.types ty ON ty.user_type_id = c.user_type_id
 WHERE c.object_id = OBJECT_ID(N'dbo.yj_usage_log') ORDER BY c.column_id;
GO
SELECT TOP 3 * FROM dbo.yj_usage_log ORDER BY id DESC;
GO
SELECT event_type, COUNT(*) AS n FROM dbo.yj_usage_log GROUP BY event_type;
