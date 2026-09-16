-- 采购入库/销售出库:表头去掉 仓库 和 金额
-- 理由:仓库和金额都是行级数据(每行各有仓库和金额),表头放一份没有意义
SET NOCOUNT ON;
-- 隐藏表头的 仓库/金额(不删,用户可通过表头调整勾选恢复)
UPDATE yj_field SET hidden=1, visible=0
WHERE panel_code IN ('PURCHASE_IN','SALE_OUT') AND place LIKE '%header%'
  AND col_name IN (N'仓库', N'金额');
GO
SELECT panel_code, col_name FROM yj_field
WHERE panel_code IN ('PURCHASE_IN','SALE_OUT') AND place LIKE '%header%'
  AND ISNULL(hidden,0)=0 AND ISNULL(visible,1)=1
ORDER BY panel_code, seq;
GO
