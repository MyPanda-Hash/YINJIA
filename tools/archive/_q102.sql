-- migrate-detail-warehouse-required.sql — 四单据明细行仓库字段设为必填+显示
SET NOCOUNT ON;

-- SO_ORDER:仓库名称→必填+显示
UPDATE yj_field SET required=1, hidden=0, visible=1 WHERE panel_code='SO_ORDER' AND place='detail' AND col_name=N'仓库名称';

-- PU_ORDER:仓库→必填(已显示)
UPDATE yj_field SET required=1 WHERE panel_code='PU_ORDER' AND place='detail' AND col_name=N'仓库';

-- PURCHASE_IN:仓库名称→必填(已显示)
UPDATE yj_field SET required=1 WHERE panel_code='PURCHASE_IN' AND place='detail' AND col_name=N'仓库名称';

-- SALE_OUT:仓库名称→必填(已显示)
UPDATE yj_field SET required=1 WHERE panel_code='SALE_OUT' AND place='detail' AND col_name=N'仓库名称';

GO
SELECT panel_code, col_name, required, hidden FROM yj_field
WHERE panel_code IN ('SO_ORDER','PU_ORDER','PURCHASE_IN','SALE_OUT')
  AND place='detail' AND (col_name LIKE N'%仓库%' OR col_name LIKE N'%仓%')
  AND (required=1 OR hidden=0)
ORDER BY panel_code, seq;
GO
