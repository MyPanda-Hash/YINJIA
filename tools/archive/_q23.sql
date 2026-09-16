SET NOCOUNT ON;
SELECT panel_code, col_name, label FROM yj_field
WHERE panel_code IN ('PURCHASE_IN','SALE_OUT')
  AND (col_name LIKE '%[a-z]%' OR col_name LIKE '%[A-Z]%')
  AND col_name NOT LIKE N'%[%]%' AND col_name NOT LIKE N'%2%' AND col_name NOT LIKE N'%id%'
ORDER BY panel_code, seq;
