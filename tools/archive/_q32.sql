SET NOCOUNT ON;
-- 采购入库:补头表 金额(total_amount 已在列)和 备注 的面板字段
IF NOT EXISTS(SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'金额' AND place LIKE '%header%')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES ('PURCHASE_IN', N'金额', N'金额', N'文本', N'header', 155, 100, 1, 0, 0, 1);
IF NOT EXISTS(SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'备注' AND place LIKE '%header%')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES ('PURCHASE_IN', N'备注', N'备注', N'文本', N'header', 180, 200, 1, 0, 0, 1);
-- 销售出库:补头表 备注
IF NOT EXISTS(SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'备注' AND place LIKE '%header%')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES ('SALE_OUT', N'备注', N'备注', N'文本', N'header', 180, 200, 1, 0, 0, 1);
SELECT panel_code, col_name FROM yj_field WHERE panel_code IN ('PURCHASE_IN','SALE_OUT') AND place LIKE '%header%' AND ISNULL(hidden,0)=0 AND ISNULL(visible,1)=1 ORDER BY panel_code, seq;
