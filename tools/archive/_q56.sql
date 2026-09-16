SET NOCOUNT ON;
-- 库存状况表:去掉 query 位(不显示搜索表头区域,纯表格展示)
UPDATE yj_field SET place = 'detail' WHERE panel_code = 'STOCK_BALANCE' AND place LIKE '%query%';
SELECT col_name, place FROM yj_field WHERE panel_code='STOCK_BALANCE' ORDER BY seq;
