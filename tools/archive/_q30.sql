SET NOCOUNT ON;
SELECT panel_code, col_name, label, place FROM yj_field
WHERE panel_code IN ('PURCHASE_IN','SALE_OUT') AND place LIKE '%header%' AND ISNULL(hidden,0)=0 AND ISNULL(visible,1)=1
ORDER BY panel_code, seq;
