SET NOCOUNT ON;
SELECT TOP 25 'F|' + CAST(seq AS VARCHAR(6)) + '|' + label + '|place=' + ISNULL(place,'') + '|col=' + col_name
FROM yj_field WHERE panel_code='INV' ORDER BY seq;
SELECT TOP 3 'W|' + CAST(seq AS VARCHAR(6)) + '|' + label + '|col=' + col_name FROM yj_field WHERE panel_code='WH' AND seq <= 40 ORDER BY seq;
