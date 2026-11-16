SET NOCOUNT ON;
SELECT 'P|' + panel_code + '|' + panel_name + '|' + mode + '|' + ISNULL(line_table,'') FROM yj_panel WHERE panel_code IN ('PROD_PICK_LIST','PROD_RET_LIST') ORDER BY panel_code;
SELECT 'F|cnt=' + CAST(COUNT(*) AS VARCHAR(5)) + '|vis=' + CAST(SUM(CASE WHEN visible=1 THEN 1 ELSE 0 END) AS VARCHAR(5)) FROM yj_field WHERE panel_code='PROD_RET_LIST';
SELECT 'GRANT|cnt=' + CAST(COUNT(*) AS VARCHAR(5)) FROM yj_role_panel WHERE panel_code='PROD_RET_LIST';
