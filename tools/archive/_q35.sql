SET NOCOUNT ON;
-- 找这些字段的真实 place 和 col_name
SELECT panel_code, col_name, place FROM yj_field
WHERE panel_code IN ('PURCHASE_IN','SALE_OUT')
  AND (col_name IN (N'存货编码',N'备注',N'单价',N'含税单价',N'金额',N'含税金额',N'售价',N'含税售价',N'销售金额',N'含税销售金额',N'批号'))
  AND col_name NOT LIKE N'%本位币%' AND col_name NOT LIKE N'%折%' AND col_name NOT LIKE N'%分%'
ORDER BY panel_code, place;
