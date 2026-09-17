SET NOCOUNT ON;
-- qc_insp_detail 补列(Java 代码查询的列)
IF COL_LENGTH('dbo.qc_insp_detail', N'型号') IS NULL
  ALTER TABLE dbo.qc_insp_detail ADD [型号] nvarchar(100) NULL;
IF COL_LENGTH('dbo.qc_insp_detail', N'数量') IS NULL
  ALTER TABLE dbo.qc_insp_detail ADD [数量] float NULL;
IF COL_LENGTH('dbo.qc_insp_detail', N'仓库代码') IS NULL
  ALTER TABLE dbo.qc_insp_detail ADD [仓库代码] nvarchar(50) NULL;
-- 从已有列同步数据(规格型号→型号,送检数量→数量)
UPDATE qc_insp_detail SET 型号 = 规格型号 WHERE 型号 IS NULL AND 规格型号 IS NOT NULL;
UPDATE qc_insp_detail SET 数量 = 送检数量 WHERE 数量 IS NULL AND 送检数量 IS NOT NULL;
SELECT c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('dbo.qc_insp_detail') ORDER BY c.column_id;
