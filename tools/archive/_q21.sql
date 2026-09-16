SET NOCOUNT ON;
SELECT panel_code, col_name, label FROM yj_field
WHERE panel_code IN ('PURCHASE_IN','SALE_OUT') AND ISNULL(hidden,0)=0 AND ISNULL(visible,1)=1
  AND (label LIKE '%[a-z]%' OR label LIKE '%[A-Z]%') AND label NOT LIKE N'%[%]%' AND label NOT LIKE N'%id%' AND label NOT LIKE N'%ID%'
ORDER BY panel_code;
