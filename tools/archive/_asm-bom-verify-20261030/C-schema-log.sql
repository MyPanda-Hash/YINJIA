SET NOCOUNT ON;
SELECT 'C-schema_log' AS what, script_name, content_hash, CAST(applied_at AS varchar(30)) AS applied_at
FROM yj_schema_log WHERE script_name IN (N'migrate-asm-bom-20261030.sql', N'migrate-asm-bom-data-20261030.sql')
ORDER BY script_name;
GO
SELECT 'C-schema_log-计数' AS what, COUNT(*) AS cnt FROM yj_schema_log
WHERE script_name IN (N'migrate-asm-bom-20261030.sql', N'migrate-asm-bom-data-20261030.sql');
GO
SELECT 'C-全表bs_asm_bom存在' AS what,
  CASE WHEN OBJECT_ID('dbo.bs_asm_bom','U') IS NOT NULL THEN 'YES' ELSE 'NO' END AS tbl,
  CASE WHEN OBJECT_ID('dbo.bs_asm_bom','U') IS NOT NULL THEN (SELECT COUNT(*) FROM bs_asm_bom) ELSE -1 END AS rows_cnt;
GO
