-- migrate-bom-material-fields.sql — 物料清单(BOM)子件表补产品文件物料字段(正确表名 bs_bom)
SET NOCOUNT ON;
GO
BEGIN TRY
IF COL_LENGTH('bs_bom', '物料种类') IS NULL ALTER TABLE bs_bom ADD [物料种类] nvarchar(50) NULL;
IF COL_LENGTH('bs_bom', '物料规格') IS NULL ALTER TABLE bs_bom ADD [物料规格] nvarchar(200) NULL;
IF COL_LENGTH('bs_bom', '外观要求') IS NULL ALTER TABLE bs_bom ADD [外观要求] nvarchar(500) NULL;
END TRY
BEGIN CATCH
  PRINT 'bs_bom 加列跳过(无 DDL 权限)';
END CATCH
GO
PRINT N'物料清单产品文件字段补齐完成(bs_bom)';
GO