SET NOCOUNT ON;
PRINT 'A: referencing objects (prod)';
SELECT DISTINCT OBJECT_NAME(d.referencing_id) AS referrer, d.referenced_entity_name AS referenced
FROM sys.sql_expression_dependencies d
WHERE d.referenced_entity_name IN ('sample_req','sample_req_detail','bd_dispatch','bl_dispatch','bd_outsource_order','bl_outsource_order','v_dispatch_detail','v_dispatch_stats');
GO
PRINT 'B: sys.sql_modules defs mentioning these';
SELECT o.name, o.type_desc FROM sys.objects o
WHERE o.type IN ('V','P','FN','IF','TF','TR')
  AND EXISTS (SELECT 1 FROM sys.sql_modules m WHERE m.object_id=o.object_id AND (m.definition LIKE '%bd_dispatch%' OR m.definition LIKE '%bl_dispatch%' OR m.definition LIKE '%sample_req%' OR m.definition LIKE '%bd_outsource_order%' OR m.definition LIKE '%bl_outsource_order%'))
ORDER BY o.name;
