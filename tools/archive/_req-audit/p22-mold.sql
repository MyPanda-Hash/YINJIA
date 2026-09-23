SET NOCOUNT ON;
SELECT N'含模具的表或列' AS sec, t.name AS tbl, c.name AS col
FROM sys.tables t JOIN sys.columns c ON c.object_id=t.object_id
WHERE c.name LIKE N'%模具%' OR t.name LIKE N'%mold%' OR t.name LIKE N'%moju%'
ORDER BY t.name, c.name;
GO
SELECT N'yj_field 含模具' AS sec, panel_code, col_name, label, place, seq FROM yj_field WHERE col_name LIKE N'%模具%' OR label LIKE N'%模具%';
GO
SELECT N'yj_field 含冲压/尺寸计算/公差' AS sec, panel_code, col_name, label, place, seq FROM yj_field WHERE label LIKE N'%公差%' OR label LIKE N'%计算%';
