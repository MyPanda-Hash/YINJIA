SET NOCOUNT ON;
IF COL_LENGTH('dbo.qc_insp_detail', N'型号') IS NULL
  ALTER TABLE dbo.qc_insp_detail ADD [型号] nvarchar(100) NULL;
IF COL_LENGTH('dbo.qc_insp_detail', N'数量') IS NULL
  ALTER TABLE dbo.qc_insp_detail ADD [数量] float NULL;
IF COL_LENGTH('dbo.qc_insp_detail', N'仓库代码') IS NULL
  ALTER TABLE dbo.qc_insp_detail ADD [仓库代码] nvarchar(50) NULL;
