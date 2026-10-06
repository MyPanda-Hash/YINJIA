SET NOCOUNT ON;
SELECT panel_code, ISNULL(head_table,'<NULL>') AS head_table, ISNULL(line_table,'<NULL>') AS line_table, detail_key, ISNULL(config,'<NULL>') AS config
FROM yj_panel WHERE panel_code = 'OP';
GO
SELECT col_name, label, data_type, place, visible, seq FROM yj_field WHERE panel_code = 'OP' ORDER BY place, seq;
GO
