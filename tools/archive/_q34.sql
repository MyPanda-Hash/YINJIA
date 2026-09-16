SET NOCOUNT ON;
SELECT panel_code, col_name, label FROM yj_field
WHERE panel_code IN ('PURCHASE_IN','SALE_OUT') AND place='detail' AND ISNULL(hidden,0)=0 AND ISNULL(visible,1)=1
ORDER BY panel_code, seq;
SELECT panel_code, COUNT(*) AS detail显示 FROM yj_field
WHERE panel_code IN ('SO_ORDER','PU_ORDER') AND place='detail' AND ISNULL(hidden,0)=0 AND ISNULL(visible,1)=1
GROUP BY panel_code;
