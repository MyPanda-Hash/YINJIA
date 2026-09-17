SET NOCOUNT ON;
IF COL_LENGTH('dbo.bd_purchase_in', N'是否已转ERP') IS NULL
  ALTER TABLE dbo.bd_purchase_in ADD [是否已转ERP] nvarchar(10) NULL;
IF COL_LENGTH('dbo.bd_sale_out', N'是否已转ERP') IS NULL
  ALTER TABLE dbo.bd_sale_out ADD [是否已转ERP] nvarchar(10) NULL;
