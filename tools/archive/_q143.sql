SET NOCOUNT ON;
SELECT panel_code, col_name, label, data_type, place FROM yj_field WHERE panel_code='PURCHASE_IN_DETAIL' AND place LIKE '%query%' ORDER BY seq;
SELECT definition FROM sys.sql_modules WHERE object_id=OBJECT_ID('dbo.v_purchase_in_detail');
