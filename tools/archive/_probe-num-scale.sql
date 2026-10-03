-- 一次性探针:统计库内 decimal/numeric 列的小数位数分布(判断「明细 vs 合计」位数差的真实来源)
SELECT c.scale AS scale, COUNT(*) AS n
FROM sys.columns c
JOIN sys.tables s ON s.object_id = c.object_id
JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE t.name IN ('decimal', 'numeric')
GROUP BY c.scale
ORDER BY c.scale;
GO
SELECT TOP 40 CONCAT(s.name, '.', c.name, '(', c.precision, ',', c.scale, ')') AS col
FROM sys.columns c
JOIN sys.tables s ON s.object_id = c.object_id
JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE t.name IN ('decimal', 'numeric') AND c.scale <> 2
ORDER BY c.scale DESC, s.name, c.name;
GO
