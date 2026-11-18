SET NOCOUNT ON;
PRINT '== 含「烧结类型」列的表 ==';
SELECT t.name AS tbl, c.name AS col FROM sys.tables t JOIN sys.columns c ON c.object_id=t.object_id WHERE c.name LIKE N'%烧结类型%';
PRINT '== plang 列 ==';
SELECT name FROM sys.columns WHERE object_id=OBJECT_ID('dbo.plang') ORDER BY column_id;
