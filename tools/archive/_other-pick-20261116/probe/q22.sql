SET NOCOUNT ON;
SELECT 'RO|' + CAST(seq AS VARCHAR(6)) + '|' + label + '|req=' + CAST(required AS VARCHAR(3)) + '|place=' + ISNULL(place,'') + '|col=' + col_name + '|dict=' + LEFT(ISNULL(dict_sql,''),60)
FROM yj_field WHERE panel_code='OTHER_OUT' AND label='业务类型';
SELECT 'RV|' + ISNULL(业务类型,N'<null>') + '|' + ISNULL(业务类型编码,N'') + '|cnt=' + CAST(COUNT(*) AS VARCHAR(8))
FROM bd_other_out GROUP BY 业务类型, 业务类型编码;
SELECT 'MRD|' + CAST(seq AS VARCHAR(6)) + '|' + label + '|req=' + CAST(required AS VARCHAR(3)) + '|place=' + ISNULL(place,'') + '|col=' + col_name
FROM yj_field WHERE panel_code='MATERIAL_RET' AND place LIKE '%detail%' ORDER BY seq;
