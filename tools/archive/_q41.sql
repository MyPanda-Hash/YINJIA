SET NOCOUNT ON;
SELECT panel_code, col_name, ref_panel FROM yj_field WHERE ref_panel='PARTNER' AND panel_code IN ('PURCHASE_IN','SALE_OUT');
