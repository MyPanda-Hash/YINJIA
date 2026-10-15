/* q-20-initrow.sql — 现存期初行(src=0)的完整形态 + inh 列清单(只读) */
SET NOCOUNT ON;
GO
SELECT * FROM dbo.inh WHERE src = 0;
GO
SELECT c.column_id, c.name, TYPE_NAME(c.user_type_id) AS typ, c.max_length, c.precision, c.scale, c.is_nullable
FROM sys.columns c WHERE c.object_id = OBJECT_ID('dbo.inh') ORDER BY c.column_id;
GO
