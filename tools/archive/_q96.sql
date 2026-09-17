SET NOCOUNT ON;
SELECT panel_code, place, col_name FROM yj_field WHERE panel_code IN ('SO_ORDER','PU_ORDER','PURCHASE_IN','SALE_OUT') AND required=1 ORDER BY panel_code, place, seq;
