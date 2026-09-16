SET NOCOUNT ON;
-- 采购入库 header 里 seq>=970 的全部字段(逐个判定该不该在 header)
SELECT col_name, label FROM yj_field WHERE panel_code='PURCHASE_IN' AND place='header' AND seq >= 970 ORDER BY seq;
