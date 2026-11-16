SET NOCOUNT ON;
SELECT 'P|' + panel_code + '|' + panel_name + '|' + ISNULL(panel_name_en,'') + '|' + mode + '|' + ISNULL(line_table,'') + '|' + ISNULL(module_group,'') + '|' + ISNULL(date_col,'') + '|ps=' + CAST(ISNULL(page_size,0) AS VARCHAR(6))
FROM yj_panel WHERE panel_code IN ('PROD_PICK_LIST','PROD_RET_LIST') ORDER BY panel_code;
SELECT 'F|' + panel_code + '|cnt=' + CAST(COUNT(*) AS VARCHAR(5)) + '|vis=' + CAST(SUM(CASE WHEN visible=1 THEN 1 ELSE 0 END) AS VARCHAR(5))
FROM yj_field WHERE panel_code='PROD_RET_LIST' GROUP BY panel_code;
SELECT 'TR|' + ref_key + '|' + locale + '|' + text FROM yj_translation WHERE scope='panel' AND ref_key IN (N'生产领料明细表',N'生产退料明细表') ORDER BY ref_key, locale;
SELECT 'GRANT|' + CAST(role_id AS VARCHAR(6)) + '|' + perms + '|' + ISNULL(can_approve,'') FROM yj_role_panel WHERE panel_code='PROD_RET_LIST';
SELECT 'VIEW|cnt=' + CAST(COUNT(*) AS VARCHAR(10)) + '|docs=' + CAST(COUNT(DISTINCT 单据编号) AS VARCHAR(10)) FROM v_prod_ret_list;
