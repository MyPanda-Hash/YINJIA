SET NOCOUNT ON;
/* 两边所有 工单ID / 工单项次 列 */
SELECT N'本地正式库' AS 库, t.name AS 表, c.name AS 列, ty.name AS 类型,
       CASE WHEN ty.name IN (N'nvarchar', N'nchar') THEN c.max_length / 2 ELSE c.max_length END AS 长,
       c.is_nullable AS 可空, c.column_id AS 列序
FROM [HSDZ_MES].sys.tables t
JOIN [HSDZ_MES].sys.columns c ON c.object_id = t.object_id
JOIN [HSDZ_MES].sys.types ty ON ty.user_type_id = c.user_type_id
WHERE c.name IN (N'工单ID', N'工单项次', N'工单行号')
UNION ALL
SELECT N'服务器快照', t.name, c.name, ty.name,
       CASE WHEN ty.name IN (N'nvarchar', N'nchar') THEN c.max_length / 2 ELSE c.max_length END,
       c.is_nullable, c.column_id
FROM [HSDZ_MES_SRV1015].sys.tables t
JOIN [HSDZ_MES_SRV1015].sys.columns c ON c.object_id = t.object_id
JOIN [HSDZ_MES_SRV1015].sys.types ty ON ty.user_type_id = c.user_type_id
WHERE c.name IN (N'工单ID', N'工单项次', N'工单行号')
ORDER BY 列, 库, 表;

/* 面板字段里登记成 工单ID / 工单项次 / 工单行号 的 */
SELECT panel_code, col_name, label, place, data_type, ref_panel, ref_field
FROM yj_field WHERE col_name IN (N'工单ID', N'工单项次', N'工单行号') OR label IN (N'工单ID', N'工单项次', N'工单行号')
ORDER BY panel_code, seq;

/* 有没有视图/存储过程引用 工单ID */
SELECT o.name AS 对象, o.type_desc FROM sys.sql_modules m JOIN sys.objects o ON o.object_id = m.object_id
WHERE m.definition LIKE N'%工单ID%';
