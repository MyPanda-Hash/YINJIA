SET NOCOUNT ON;
SELECT col_name, data_type, ref_panel, place FROM yj_field WHERE panel_code='STOCK_LEDGER' AND place LIKE N'%query%' ORDER BY seq;
