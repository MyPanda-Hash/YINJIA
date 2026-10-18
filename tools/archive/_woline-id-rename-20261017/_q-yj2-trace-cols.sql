SET NOCOUNT ON;
/* 早期服务器备份 HSDZ_MES_YJ2(源库 HSDZ_MES,2026-10-15 02:23)上 inh/outh 的工单追溯列长什么样 ——
   用来判定「服务器那列叫 工单ID」的说法在什么时点成立。 */
SELECT t.name AS 表, c.name AS 列, ty.name AS 类型,
       CASE WHEN ty.name IN (N'nvarchar', N'nchar') THEN c.max_length / 2 ELSE c.max_length END AS 长,
       c.is_nullable AS 可空, c.column_id AS 列序, dc.definition AS 默认值
FROM [HSDZ_MES_YJ2].sys.tables t
JOIN [HSDZ_MES_YJ2].sys.columns c ON c.object_id = t.object_id
JOIN [HSDZ_MES_YJ2].sys.types ty ON ty.user_type_id = c.user_type_id
LEFT JOIN [HSDZ_MES_YJ2].sys.default_constraints dc ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id
WHERE t.name IN (N'inh', N'outh') AND (c.name LIKE N'%工单%' OR c.name LIKE N'%ID%' OR c.name LIKE N'%审核%')
ORDER BY t.name, c.column_id;

/* 同库列数 */
SELECT t.name AS 表, COUNT(*) AS 列数
FROM [HSDZ_MES_YJ2].sys.tables t JOIN [HSDZ_MES_YJ2].sys.columns c ON c.object_id = t.object_id
WHERE t.name IN (N'inh', N'outh') GROUP BY t.name;
