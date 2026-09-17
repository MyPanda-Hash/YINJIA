SET NOCOUNT ON;
-- qc_insp 补列:与 Java 代码 syncInspFromSlRecv 期望的列对齐
IF COL_LENGTH('dbo.qc_insp', N'业务员') IS NULL
  ALTER TABLE dbo.qc_insp ADD [业务员] nvarchar(50) NULL;
IF COL_LENGTH('dbo.qc_insp', N'供应商代码') IS NULL
  ALTER TABLE dbo.qc_insp ADD [供应商代码] nvarchar(50) NULL;
IF COL_LENGTH('dbo.qc_insp', N'部门') IS NULL
  ALTER TABLE dbo.qc_insp ADD [部门] nvarchar(50) NULL;
IF COL_LENGTH('dbo.qc_insp', N'部门名称') IS NULL
  ALTER TABLE dbo.qc_insp ADD [部门名称] nvarchar(50) NULL;
IF COL_LENGTH('dbo.qc_insp', N'数量') IS NULL
  ALTER TABLE dbo.qc_insp ADD [数量] float NULL;
SELECT c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('dbo.qc_insp') ORDER BY c.column_id;
