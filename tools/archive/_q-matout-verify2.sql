SET NOCOUNT ON;
PRINT '=== 头字段(place header)· 显示优先 ===';
SELECT col_name, visible, seq FROM yj_field WHERE panel_code='MATERIAL_OUT' AND place LIKE '%header%' AND hidden=0 ORDER BY seq;
GO
SELECT col_name, visible, seq FROM yj_field WHERE panel_code='MATERIAL_OUT' AND place LIKE '%header%' AND hidden=1 ORDER BY seq;
GO
PRINT '=== 行字段·显示(仅新加,seq>=970) ===';
SELECT col_name, seq FROM yj_field WHERE panel_code='MATERIAL_OUT' AND place='detail' AND hidden=0 AND seq>=970 ORDER BY seq;
GO
