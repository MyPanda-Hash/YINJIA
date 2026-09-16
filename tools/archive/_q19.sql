SET NOCOUNT ON;
SELECT panel_code, COUNT(*) AS 总, SUM(CASE WHEN ISNULL(hidden,0)=0 AND ISNULL(visible,1)=1 THEN 1 ELSE 0 END) AS 显示,
  SUM(CASE WHEN (label LIKE '%[a-z]%' OR label LIKE '%[A-Z]%') AND label NOT LIKE N'%[%]%' AND label NOT LIKE N'%id%' AND label NOT LIKE N'%ID%' THEN 1 ELSE 0 END) AS 英文标签
FROM yj_field WHERE panel_code IN ('PURCHASE_IN','SALE_OUT') GROUP BY panel_code;
