SET NOCOUNT ON;
SELECT 'P|' + panel_code + '|' + panel_name + '|' + mode + '|' + ISNULL(line_table,'')
FROM yj_panel WHERE line_table IN ('bs_inv','bs_wh') OR panel_code IN ('INV','BS_INV','STOCK_PICK','WH') ORDER BY panel_code;
SELECT 'H|' + label + '|req=' + CAST(required AS VARCHAR(3)) + '|place=' + ISNULL(place,'') + '|col=' + col_name
FROM yj_field WHERE panel_code='MATERIAL_RET' AND NOT (place LIKE '%detail%' AND place NOT LIKE '%header%') ORDER BY seq;
