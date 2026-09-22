/* 全库扫一遍:所有带 panel_code 列的表里,QC_TC 各有多少行。
   用途:确保「彻底删掉面板与表」不漏掉任何挂账表(状态/占用/附件/批次/链路/权限…)。 */
SET NOCOUNT ON;
DECLARE @s nvarchar(max) = N'';
SELECT @s = @s + N'SELECT N''' + t.name + N''' AS 表名, COUNT(*) AS 行数 FROM '
              + QUOTENAME(t.name) + N' WHERE panel_code = N''QC_TC'' UNION ALL '
FROM sys.tables t
JOIN sys.columns c ON c.object_id = t.object_id AND c.name = 'panel_code'
WHERE t.name <> 'yj_schema_log'
ORDER BY t.name;
SET @s = LEFT(@s, LEN(@s) - LEN(N' UNION ALL ')) + N' ORDER BY 行数 DESC, 表名';
EXEC sp_executesql @s;
