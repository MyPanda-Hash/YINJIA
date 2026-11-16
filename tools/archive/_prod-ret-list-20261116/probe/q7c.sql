SET NOCOUNT ON;
SELECT 'FIELD|' + CAST(seq AS VARCHAR(10)) + '|' + label + '|' + ISNULL(place,'') + '|vis=' + CAST(visible AS VARCHAR(3)) + '|hid=' + CAST(hidden AS VARCHAR(3)) + '|col=' + col_name + '|dt=' + ISNULL(data_type,'') + '|w=' + CAST(ISNULL(width,0) AS VARCHAR(6)) + '|en=' + ISNULL(label_en,'')
FROM yj_field WHERE panel_code='PROD_PICK_LIST' ORDER BY seq;
