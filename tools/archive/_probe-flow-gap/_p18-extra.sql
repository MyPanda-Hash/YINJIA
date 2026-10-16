SET NOCOUNT ON;
SELECT 'maint_plan' AS t, COUNT(*) AS n FROM maint_plan
UNION ALL SELECT 'sample_req', COUNT(*) FROM sample_req
UNION ALL SELECT 'bd_prod_abn', COUNT(*) FROM bd_prod_abn
UNION ALL SELECT 'wh_record', COUNT(*) FROM wh_record
UNION ALL SELECT 'gran_record', COUNT(*) FROM gran_record;
GO
