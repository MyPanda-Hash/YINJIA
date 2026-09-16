SET NOCOUNT ON;
-- SO/PU 表头已显示字段(参考模板)
SELECT panel_code, place, col_name, label FROM yj_field
WHERE panel_code IN ('SO_ORDER','PU_ORDER') AND place LIKE '%header%' AND ISNULL(hidden,0)=0 AND ISNULL(visible,1)=1
ORDER BY panel_code, seq;
-- 采购入库/销售出库 表头已显示
SELECT panel_code, place, col_name, label FROM yj_field
WHERE panel_code IN ('PURCHASE_IN','SALE_OUT') AND place LIKE '%header%' AND ISNULL(hidden,0)=0 AND ISNULL(visible,1)=1
ORDER BY panel_code, seq;
