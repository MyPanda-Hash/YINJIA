-- 补充:入库/出库明细遗漏字段(place 含 query 的精确名不同/售价系列)
SET NOCOUNT ON;
-- PURCHASE_IN:存货编码在 query,detail;补显示
UPDATE yj_field SET hidden=0, visible=1 WHERE panel_code='PURCHASE_IN' AND place='query,detail' AND col_name=N'存货编码';
-- SALE_OUT:用 MES 原名(售价/含税售价/销售金额/含税销售金额);批号在 query,detail
UPDATE yj_field SET hidden=0, visible=1 WHERE panel_code='SALE_OUT' AND place='detail' AND col_name IN (N'售价', N'含税售价', N'销售金额', N'含税销售金额');
UPDATE yj_field SET hidden=0, visible=1 WHERE panel_code='SALE_OUT' AND place='query,detail' AND col_name IN (N'批号', N'存货编码');
GO
SELECT panel_code, col_name FROM yj_field
WHERE panel_code IN ('PURCHASE_IN','SALE_OUT') AND place LIKE '%detail%' AND ISNULL(hidden,0)=0 AND ISNULL(visible,1)=1
ORDER BY panel_code, seq;
GO
