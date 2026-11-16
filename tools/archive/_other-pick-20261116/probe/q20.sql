SET NOCOUNT ON;
SELECT 'P|' + panel_code + '|' + panel_name + '|' + mode + '|head=' + ISNULL(head_table,'') + '|line=' + ISNULL(line_table,'') + '|prefix=' + ISNULL(prefix,'') + '|code_col=' + ISNULL(code_col,'')
FROM yj_panel WHERE panel_code IN ('OTHER_IN','OTHER_OUT','MATERIAL_RET','MATERIAL_OUT') ORDER BY panel_code;
SELECT 'F|' + panel_code + '|' + CAST(seq AS VARCHAR(6)) + '|' + label + '|req=' + CAST(required AS VARCHAR(3)) + '|place=' + ISNULL(place,'') + '|col=' + col_name
FROM yj_field WHERE panel_code='OTHER_OUT' AND (place LIKE '%header%' OR place='query' OR required=1) ORDER BY seq;
SELECT 'F2|' + CAST(seq AS VARCHAR(6)) + '|' + label + '|req=' + CAST(required AS VARCHAR(3)) + '|place=' + ISNULL(place,'') + '|col=' + col_name
FROM yj_field WHERE panel_code='OTHER_OUT' AND place LIKE '%detail%' ORDER BY seq;
