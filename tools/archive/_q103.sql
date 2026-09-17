SET NOCOUNT ON;
UPDATE yj_field SET required=1, hidden=0, visible=1 WHERE panel_code='SO_ORDER' AND place='detail' AND col_name=N'仓库名称';
UPDATE yj_field SET required=1 WHERE panel_code='PU_ORDER' AND place='detail' AND col_name=N'仓库';
UPDATE yj_field SET required=1 WHERE panel_code='PURCHASE_IN' AND place='detail' AND col_name=N'仓库名称';
UPDATE yj_field SET required=1 WHERE panel_code='SALE_OUT' AND place='detail' AND col_name=N'仓库名称';
SELECT panel_code, col_name, required FROM yj_field
WHERE panel_code IN ('SO_ORDER','PU_ORDER','PURCHASE_IN','SALE_OUT')
  AND place='detail' AND col_name IN (N'仓库',N'仓库名称') ORDER BY panel_code;
