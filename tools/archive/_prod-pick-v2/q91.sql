SET NOCOUNT ON;
SELECT '工单' k, COUNT(*) n FROM plang WHERE pl_no LIKE 'GD-DEMO-%' AND ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT '台账', COUNT(*) FROM wo_pick_doc
UNION ALL SELECT '退料台账', COUNT(*) FROM wo_pick_return;
GO
-- 可用物料(恒亿仓,库存充足)
SELECT TOP 20 存货编码, 存货名称, 计量单位, 现存量 FROM v_stock_pick
 WHERE 仓库='恒亿仓' AND 现存量 > 500 AND 存货编码 LIKE 'YJ-%' ORDER BY 现存量 DESC;
