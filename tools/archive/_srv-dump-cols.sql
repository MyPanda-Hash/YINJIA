SET NOCOUNT ON;
SELECT t.name + '|' + c.name + '|' + TYPE_NAME(c.system_type_id)
       + CASE WHEN TYPE_NAME(c.system_type_id) IN (N'varchar',N'nvarchar',N'char',N'nchar')
              THEN '(' + CAST(c.max_length / CASE WHEN TYPE_NAME(c.system_type_id) IN (N'nvarchar',N'nchar') THEN 2 ELSE 1 END AS varchar(10)) + ')'
              ELSE '' END AS sig
FROM HSDZ_MES.sys.tables t
JOIN HSDZ_MES.sys.columns c ON c.object_id = t.object_id
WHERE t.is_ms_shipped = 0
UNION ALL
SELECT v.name + '|' + c.name + '|<view>'
FROM HSDZ_MES.sys.views v
JOIN HSDZ_MES.sys.columns c ON c.object_id = v.object_id
ORDER BY 1;
GO
SELECT t.name + '|' + c.name + '|' + TYPE_NAME(c.system_type_id)
       + CASE WHEN TYPE_NAME(c.system_type_id) IN (N'varchar',N'nvarchar',N'char',N'nchar')
              THEN '(' + CAST(c.max_length / CASE WHEN TYPE_NAME(c.system_type_id) IN (N'nvarchar',N'nchar') THEN 2 ELSE 1 END AS varchar(10)) + ')'
              ELSE '' END AS sig
FROM HSDZ_MES_TEST.sys.tables t
JOIN HSDZ_MES_TEST.sys.columns c ON c.object_id = t.object_id
WHERE t.is_ms_shipped = 0
UNION ALL
SELECT v.name + '|' + c.name + '|<view>'
FROM HSDZ_MES_TEST.sys.views v
JOIN HSDZ_MES_TEST.sys.columns c ON c.object_id = v.object_id
ORDER BY 1;
GO
