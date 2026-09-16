SET NOCOUNT ON;
SELECT panel_code, col_name, ref_panel, ref_field, display_field FROM yj_field
WHERE panel_code IN ('PURCHASE_IN','SALE_OUT','SO_ORDER','PU_ORDER') AND ISNULL(ref_panel,'')<>''
ORDER BY panel_code, seq;
