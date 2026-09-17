-- migrate-stock-balance-cascade.sql — 库存状况表查询弹窗级联字段
-- 仓库/存货 place 补 query(弹窗字段注册);弹窗内走联动下拉(选项=v_stock_balance 真实组合),不走通用参照
SET NOCOUNT ON;
UPDATE yj_field SET place = N'query,detail'
WHERE panel_code='STOCK_BALANCE' AND col_name IN (N'仓库', N'存货') AND place NOT LIKE N'%query%';
SELECT col_name, place, data_type FROM yj_field WHERE panel_code='STOCK_BALANCE' AND place LIKE N'%query%' ORDER BY seq;
PRINT N'库存状况表级联查询字段完成';
