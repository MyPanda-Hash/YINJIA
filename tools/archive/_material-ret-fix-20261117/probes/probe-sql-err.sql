SET NOCOUNT ON;
BEGIN TRY
  EXEC sp_executesql N'SELECT TOP 1 t.[加工单号] AS [工单号], t.[工单行号] AS [工单行号] FROM dbo.bl_material_ret t';
  PRINT 'OK 工单行号 可读';
END TRY
BEGIN CATCH
  PRINT 'ERR: ' + ERROR_MESSAGE();
END CATCH
BEGIN TRY
  EXEC sp_executesql N'SELECT TOP 1 t.[加工单号] AS [工单号] FROM dbo.bl_material_ret t';
  PRINT 'OK 加工单号 可读';
END TRY
BEGIN CATCH
  PRINT 'ERR2: ' + ERROR_MESSAGE();
END CATCH