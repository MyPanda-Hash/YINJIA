SET NOCOUNT ON;
-- SO/PU 明细行显示字段(参考模板)
SELECT panel_code, col_name, label FROM yj_field
WHERE panel_code IN ('SO_ORDER','PU_ORDER') AND place='detail' AND ISNULL(hidden,0)=0 AND ISNULL(visible,1)=1
ORDER BY panel_code, seq;
-- 入库/出库明细行当前显示
SELECT panel_code, col_name, label FROM yj_field
WHERE panel_code IN ('PURCHASE_IN','SALE_OUT') AND place='detail' AND ISNULL(hidden,0)=0 AND ISNULL(visible,1)=1
ORDER BY panel_code, seq;
