SET NOCOUNT ON;
SELECT col_name, label, place, seq, hidden, visible,
       CASE WHEN label = col_name THEN N'标签=列名' ELSE N'标签≠列名' END AS 备注
FROM yj_field
WHERE panel_code='MATERIAL_OUT' AND (label LIKE N'%[a-zA-Z_]%' OR col_name LIKE N'%[a-zA-Z_]%')
ORDER BY place, seq;
GO
SELECT '含下划线/英文的标签去重' AS k, COUNT(*) AS 个数 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND (label LIKE N'%[_]%' OR label LIKE N'%[a-zA-Z]%');
GO
