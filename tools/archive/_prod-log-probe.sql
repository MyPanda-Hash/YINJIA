SET NOCOUNT ON;
PRINT '--- 迁移登记(生产域) ---';
SELECT script_name AS s, LEFT(content_hash,10) AS h, CONVERT(varchar(19), applied_at, 120) AS t
FROM yj_schema_log
WHERE script_name LIKE '%manu%' OR script_name LIKE '%schedule%' OR script_name LIKE '%prod-%'
   OR script_name LIKE '%line-%' OR script_name LIKE '%wo-report%' OR script_name LIKE '%op-time%'
   OR script_name LIKE '%panel-flow%' OR script_name LIKE '%single-track%'
ORDER BY script_name;
PRINT '--- 迁移登记总数 ---';
SELECT COUNT(*) AS total FROM yj_schema_log;
