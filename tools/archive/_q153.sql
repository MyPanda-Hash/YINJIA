SET NOCOUNT ON;
SELECT col_name, place, data_type, ref_panel, visible FROM yj_field WHERE panel_code='STOCK_BALANCE' ORDER BY seq;
