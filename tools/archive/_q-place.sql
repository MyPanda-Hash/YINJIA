SET NOCOUNT ON;
SELECT col_name, '[' + place + ']' AS place_quoted, seq, visible, id
FROM yj_field WHERE panel_code='MANU_ORDER' AND place LIKE '%query%'
ORDER BY col_name, seq, id;
