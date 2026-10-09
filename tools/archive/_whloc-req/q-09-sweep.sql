SET NOCOUNT ON;
PRINT N'=== 在 yj_* 元数据表的所有字符列里搜「库位」(兜底,防止漏) ===';
DECLARE @sql nvarchar(max) = N'';
SELECT @sql = @sql + N'UNION ALL SELECT ''' + t.name + N''' AS 表, ''' + c.name + N''' AS 列, COUNT(*) AS 命中行 FROM dbo.' + QUOTENAME(t.name) + N' WHERE CAST(' + QUOTENAME(c.name) + N' AS nvarchar(max)) LIKE N''%库位%'' '
FROM sys.columns c
JOIN sys.tables t ON t.object_id = c.object_id
JOIN sys.types ty ON ty.user_type_id = c.user_type_id
WHERE t.name LIKE N'yj[_]%' AND ty.name IN (N'nvarchar', N'nchar', N'varchar', N'char', N'ntext')
  AND c.name NOT LIKE N'备用%';
SET @sql = STUFF(@sql, 1, 10, N'');
IF @sql = N'' PRINT N'(无字符列)';
ELSE BEGIN
  SET @sql = N'SELECT * FROM (' + @sql + N') x WHERE 命中行 > 0 ORDER BY 表, 列';
  EXEC sp_executesql @sql;
END
GO
PRINT N'=== 底:菜单/按钮/字典等其它可能的落点 ===';
SELECT N'yj_panel' AS 表, panel_code AS 码, panel_name AS 值 FROM yj_panel WHERE panel_name LIKE N'%库位%'
UNION ALL SELECT N'yj_panel.module_group', panel_code, module_group FROM yj_panel WHERE module_group LIKE N'%库位%'
UNION ALL SELECT N'yj_panel.detail_key', panel_code, detail_key FROM yj_panel WHERE detail_key LIKE N'%库位%'
UNION ALL SELECT N'yj_panel.line_table', panel_code, line_table FROM yj_panel WHERE line_table LIKE N'%库位%'
UNION ALL SELECT N'yj_field', panel_code + '/' + col_name, label FROM yj_field WHERE label LIKE N'%库位%' OR col_name LIKE N'%库位%';
GO
