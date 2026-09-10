-- migrate-aux-line-wh.sql — 委外入库行表补[仓库]列(与其它单据行表一致;引擎按全部字段写行)
SET NOCOUNT ON;
BEGIN TRY
  IF COL_LENGTH('bl_outsource_in', '仓库') IS NULL ALTER TABLE bl_outsource_in ADD [仓库] nvarchar(100) NULL;
END TRY
BEGIN CATCH
  PRINT '加列跳过(无 DDL 权限)';
END CATCH
GO
PRINT N'migrate-aux-line-wh 完成';
GO
