SET NOCOUNT ON;
SELECT o.type_desc AS 类型, OBJECT_SCHEMA_NAME(o.schema_id) AS 架构, o.name AS 对象,
       CONVERT(varchar(19), o.modify_date, 120) AS 服务器修改,
       CONVERT(varchar(19), l.modify_date, 120) AS 本地修改
FROM HSDZ_MES_SRV1017.sys.objects o
LEFT JOIN HSDZ_MES.sys.objects l ON l.name=o.name AND l.type=o.type
WHERE o.is_ms_shipped=0 AND o.modify_date >= '2026-10-16'
ORDER BY o.type_desc, o.name;
