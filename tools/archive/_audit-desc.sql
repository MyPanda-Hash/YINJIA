-- _audit-desc.sql — 只读审计:数据库注明覆盖与补写风险预检(不写任何数据)
SET NOCOUNT ON;
PRINT N'=== A. 缺表级注明的表(全部) ===';
SELECT t.name AS missing_table
FROM sys.tables t
WHERE NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
                  WHERE ep.major_id = t.object_id AND ep.minor_id = 0 AND ep.name = N'MS_Description')
ORDER BY t.name;

PRINT N'=== B1. 缺列级注明分布(按表:中文列缺/非中文列缺) ===';
SELECT t.name AS tbl,
       SUM(CASE WHEN c.name LIKE N'%[一-鿿]%' THEN 1 ELSE 0 END) AS cjk_missing,
       SUM(CASE WHEN c.name NOT LIKE N'%[一-鿿]%' THEN 1 ELSE 0 END) AS ascii_missing
FROM sys.columns c
JOIN sys.tables t ON t.object_id = c.object_id
WHERE NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
                  WHERE ep.major_id = c.object_id AND ep.minor_id = c.column_id AND ep.name = N'MS_Description')
GROUP BY t.name
ORDER BY t.name;

PRINT N'=== B2. 非中文列且 yj_field 反查不到 → 自动补不了,需人工(表|列) ===';
SELECT t.name AS tbl, c.name AS col
FROM sys.columns c
JOIN sys.tables t ON t.object_id = c.object_id
WHERE NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
                  WHERE ep.major_id = c.object_id AND ep.minor_id = c.column_id AND ep.name = N'MS_Description')
  AND c.name NOT LIKE N'%[一-鿿]%'
  AND NOT EXISTS (SELECT 1 FROM yj_field f WHERE f.col_name = c.name)
ORDER BY t.name, c.name;

PRINT N'=== C1. 视图缺注明 ===';
SELECT v.name AS missing_view
FROM sys.views v
WHERE NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
                  WHERE ep.major_id = v.object_id AND ep.minor_id = 0 AND ep.name = N'MS_Description')
ORDER BY v.name;

PRINT N'=== C2. 已有描述超长(>390字符,接近 #tabdesc nvarchar(400) 上限) ===';
SELECT OBJECT_NAME(ep.major_id) AS obj, LEN(CAST(ep.value AS nvarchar(max))) AS len
FROM sys.extended_properties ep
WHERE ep.name = N'MS_Description' AND LEN(CAST(ep.value AS nvarchar(max))) > 390;

PRINT N'=== C3. 全库表清单(供与脚本比对) ===';
SELECT name FROM sys.tables ORDER BY name;
