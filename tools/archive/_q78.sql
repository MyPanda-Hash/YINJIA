SET NOCOUNT ON;
SELECT panel_code, place, COUNT(*) AS 总, SUM(CASE WHEN ISNULL(hidden,0)=0 AND ISNULL(visible,1)=1 THEN 1 ELSE 0 END) AS 显示
FROM yj_field WHERE panel_code IN ('PURCHASE_IN','SALE_OUT') GROUP BY panel_code, place ORDER BY panel_code, place;
