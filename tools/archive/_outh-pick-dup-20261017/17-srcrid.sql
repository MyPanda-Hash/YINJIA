SET NOCOUNT ON;
PRINT N'== inh / outh 的 src、rid 列定义 + 中文注明 ==';
SELECT o.name AS 表, c.name AS 列, t.name AS 类型, c.max_length AS 长度,
       CASE c.is_nullable WHEN 1 THEN N'可空' ELSE N'NOT NULL' END AS 可空,
       CAST(ep.value AS nvarchar(400)) AS 中文注明
  FROM sys.columns c
  JOIN sys.objects o ON o.object_id = c.object_id
  JOIN sys.types t ON t.user_type_id = c.user_type_id
  LEFT JOIN sys.extended_properties ep
         ON ep.major_id = c.object_id AND ep.minor_id = c.column_id AND ep.class = 1 AND ep.name = 'MS_Description'
 WHERE o.name IN (N'inh', N'outh') AND c.name IN (N'src', N'rid')
 ORDER BY o.name, c.column_id;
PRINT N'== 各段号实际行数(inh/outh,未作废)==';
SELECT N'inh' AS 表, src, 单据类型, COUNT(*) AS 行数 FROM dbo.inh WHERE ISNULL(asp_cancel,'N') <> 'Y' GROUP BY src, 单据类型
UNION ALL
SELECT N'outh', src, 单据类型, COUNT(*) FROM dbo.outh WHERE ISNULL(asp_cancel,'N') <> 'Y' GROUP BY src, 单据类型
ORDER BY 表 DESC, src;
