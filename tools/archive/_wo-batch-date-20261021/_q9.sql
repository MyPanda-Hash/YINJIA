SET NOCOUNT ON;
SELECT c.name AS col, ty.name AS typ FROM sys.columns c JOIN sys.types ty ON ty.user_type_id=c.user_type_id
WHERE c.object_id=OBJECT_ID('dbo.inh') ORDER BY c.column_id;
GO
SELECT c.name AS col, ty.name AS typ FROM sys.columns c JOIN sys.types ty ON ty.user_type_id=c.user_type_id
WHERE c.object_id=OBJECT_ID('dbo.outh') ORDER BY c.column_id;
GO
SELECT TOP 20 * FROM dbo.kucun WHERE lot_no=N'20261014';
GO
