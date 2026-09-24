SET NOCOUNT ON;
SELECT name, (SELECT COUNT(*) FROM sys.columns c WHERE c.object_id = t.object_id) AS cols FROM sys.tables t WHERE name LIKE '%gx%' OR name LIKE '%gongshi%' OR name IN ('dm_gx','gxgs','bs_line_capacity','bs_prod_line') ORDER BY name;
