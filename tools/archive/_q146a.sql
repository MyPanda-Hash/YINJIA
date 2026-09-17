SET NOCOUNT ON;
IF COL_LENGTH('dbo.yj_field', N'col_group') IS NULL
  ALTER TABLE dbo.yj_field ADD [col_group] nvarchar(50) NULL;
