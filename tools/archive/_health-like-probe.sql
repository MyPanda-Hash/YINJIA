-- _health-like-probe.sql 只读:验证「列名是否含中文」的判定写法
SELECT
  CASE WHEN N'a'      LIKE N'%[^ -~]%' THEN 1 ELSE 0 END AS ascii_in_neg_class_期望0,
  CASE WHEN N'数量'   LIKE N'%[^ -~]%' THEN 1 ELSE 0 END AS cjk_in_neg_class_期望1,
  CASE WHEN N'数量'   LIKE N'%[一-鿿]%' THEN 1 ELSE 0 END AS cjk_in_range_期望1,
  CASE WHEN N'a'      LIKE N'%[一-鿿]%' THEN 1 ELSE 0 END AS ascii_in_range_期望0,
  CASE WHEN N'数量'   LIKE N'%[^a-zA-Z0-9_]%' THEN 1 ELSE 0 END AS cjk_in_ascii_class_期望1,
  CASE WHEN N'a_1'    LIKE N'%[^a-zA-Z0-9_]%' THEN 1 ELSE 0 END AS ascii_in_ascii_class_期望0,
  CASE WHEN CAST(N'数量' AS varbinary(4000)) <> CAST(CAST(N'数量' COLLATE Latin1_General_BIN2 AS varchar(4000)) AS varbinary(4000)) THEN 1 ELSE 0 END AS cjk_varbin_期望1,
  CASE WHEN CAST(N'a_1'  AS varbinary(4000)) <> CAST(CAST(N'a_1'  COLLATE Latin1_General_BIN2 AS varchar(4000)) AS varbinary(4000)) THEN 1 ELSE 0 END AS ascii_varbin_期望0,
  DATABASEPROPERTYEX(DB_NAME(),'Collation') AS 库排序规则;
GO
SELECT t.name AS 表, COUNT(*) AS 列数, STRING_AGG(c.name, N', ') AS 列清单
FROM sys.columns c JOIN sys.tables t ON t.object_id = c.object_id
WHERE NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
                  WHERE ep.major_id = c.object_id AND ep.minor_id = c.column_id AND ep.name = 'MS_Description')
  AND c.name NOT LIKE N'asp[_]%' AND c.name <> N'id'
  AND c.name LIKE N'%[a-zA-Z]%'
  AND c.name NOT LIKE N'%[^a-zA-Z0-9_]%'
GROUP BY t.name ORDER BY 2 DESC, 1;
