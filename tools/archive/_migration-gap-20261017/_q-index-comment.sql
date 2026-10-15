SET NOCOUNT ON;
DECLARE @t TABLE (n sysname);
INSERT INTO @t (n) VALUES (N'dm_langue'), (N'gscs'), (N'permission'), (N's_commdata'), (N's_sys'), (N's_xtcs');

/* ① 服务器上这 6 张表的索引定义(键列/包含列/唯一/筛选) */
SELECT t.name AS 表, i.name AS 索引名,
       CASE WHEN i.is_primary_key = 1 THEN N'PK' ELSE N'IX' END AS 种类,
       i.type_desc AS 类型, i.is_unique AS 唯一, ISNULL(i.filter_definition, N'') AS 筛选,
       STUFF((SELECT N', ' + c.name + CASE WHEN ic.is_descending_key = 1 THEN N' DESC' ELSE N'' END
                FROM [HSDZ_MES_SRV1015].sys.index_columns ic
                JOIN [HSDZ_MES_SRV1015].sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
               WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id AND ic.is_included_column = 0
               ORDER BY ic.key_ordinal FOR XML PATH(''), TYPE).value(N'.', N'nvarchar(max)'), 1, 2, N'') AS 键列,
       ISNULL(STUFF((SELECT N', ' + c.name
                FROM [HSDZ_MES_SRV1015].sys.index_columns ic
                JOIN [HSDZ_MES_SRV1015].sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
               WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id AND ic.is_included_column = 1
               ORDER BY ic.index_column_id FOR XML PATH(''), TYPE).value(N'.', N'nvarchar(max)'), 1, 2, N''), N'') AS 包含列
FROM [HSDZ_MES_SRV1015].sys.tables t
JOIN [HSDZ_MES_SRV1015].sys.indexes i ON i.object_id = t.object_id AND i.type > 0
JOIN @t f ON f.n = t.name
ORDER BY t.name, i.is_primary_key DESC, i.name;

/* ② 服务器上这 6 张表的列级中文注明(抽样看前若干条,确认是中文有意义) */
SELECT TOP 40 t.name AS 表, c.name AS 列, CAST(ep.value AS nvarchar(200)) AS 注明
FROM [HSDZ_MES_SRV1015].sys.extended_properties ep
JOIN [HSDZ_MES_SRV1015].sys.tables t ON t.object_id = ep.major_id
JOIN [HSDZ_MES_SRV1015].sys.columns c ON c.object_id = ep.major_id AND c.column_id = ep.minor_id
JOIN @t f ON f.n = t.name
WHERE ep.name = N'MS_Description' AND ep.minor_id > 0
ORDER BY t.name, c.column_id;

/* ③ 每表列级注明条数 */
SELECT t.name AS 表, COUNT(*) AS 服务器列注明条数
FROM [HSDZ_MES_SRV1015].sys.extended_properties ep
JOIN [HSDZ_MES_SRV1015].sys.tables t ON t.object_id = ep.major_id
JOIN @t f ON f.n = t.name
WHERE ep.name = N'MS_Description' AND ep.minor_id > 0
GROUP BY t.name ORDER BY t.name;
