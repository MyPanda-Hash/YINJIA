SET NOCOUNT ON;
IF COL_LENGTH('dbo.bl_pu_order', N'这个列不存在') IS NOT NULL
BEGIN
  SELECT [这个列不存在] FROM dbo.bl_pu_order;
END
PRINT 'guard-ok';
GO
SELECT TOP 1 行号 FROM bl_pu_order;
