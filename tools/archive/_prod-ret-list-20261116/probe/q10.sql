SET NOCOUNT ON;
SELECT 'GRP|' + ISNULL(module_group,'<null>') + '|cnt=' + CAST(COUNT(*) AS VARCHAR(10)) FROM yj_panel GROUP BY module_group;
SELECT 'PICKROW|' + panel_name + '|' + ISNULL(panel_name_en,'') + '|' + ISNULL(module_group,'') + '|' + mode + '|' + ISNULL(category,'') + '|ps=' + CAST(ISNULL(page_size,0) AS VARCHAR(6)) + '|' + ISNULL(detail_key,'') + '|' + ISNULL(line_table,'')
FROM yj_panel WHERE panel_code='PROD_PICK_LIST';
