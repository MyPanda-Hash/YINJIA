SET NOCOUNT ON;
WITH loc AS (
  SELECT CONCAT(SCHEMA_NAME(t.schema_id),'.',t.name,'.',c.name,'|',ty.name,'|',c.max_length,'|',c.precision,'|',c.scale,'|',c.is_nullable,'|',c.is_identity,'|',ISNULL(c.collation_name,'-')) AS k
  FROM HSDZ_MES.sys.columns c JOIN HSDZ_MES.sys.tables t ON t.object_id=c.object_id AND t.is_ms_shipped=0
  JOIN HSDZ_MES.sys.types ty ON ty.user_type_id=c.user_type_id),
srv AS (
  SELECT CONCAT(SCHEMA_NAME(t.schema_id),'.',t.name,'.',c.name,'|',ty.name,'|',c.max_length,'|',c.precision,'|',c.scale,'|',c.is_nullable,'|',c.is_identity,'|',ISNULL(c.collation_name,'-')) AS k
  FROM HSDZ_MES_SRV1017.sys.columns c JOIN HSDZ_MES_SRV1017.sys.tables t ON t.object_id=c.object_id AND t.is_ms_shipped=0
  JOIN HSDZ_MES_SRV1017.sys.types ty ON ty.user_type_id=c.user_type_id)
SELECT '仅本地' AS 差异, loc.k AS 列定义 FROM loc WHERE NOT EXISTS (SELECT 1 FROM srv WHERE srv.k = loc.k)
UNION ALL
SELECT '仅服务器', srv.k FROM srv WHERE NOT EXISTS (SELECT 1 FROM loc WHERE loc.k = srv.k);
