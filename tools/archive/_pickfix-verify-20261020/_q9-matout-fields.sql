SET NOCOUNT ON;
SELECT label, col_name, place, required, visible, hidden, seq, data_type, dict_sql
  FROM yj_field WHERE panel_code = N'MATERIAL_OUT' ORDER BY seq, id;
