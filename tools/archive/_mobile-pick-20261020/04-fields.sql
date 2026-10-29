SET NOCOUNT ON;
SELECT place, label, seq, required, editable, hidden FROM dbo.yj_field
 WHERE panel_code = N'MATERIAL_OUT' AND place IN (N'header', N'detail', N'query')
 ORDER BY place, seq;
