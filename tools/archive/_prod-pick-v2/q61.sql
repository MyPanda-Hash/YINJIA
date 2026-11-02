SET NOCOUNT ON;
SELECT TOP 12 存货编码, 存货名称, 计量单位 FROM bs_inv WHERE 存货编码 LIKE 'B-%' OR 存货编码 LIKE 'C-%' GROUP BY 存货编码, 存货名称, 计量单位 ORDER BY 存货编码;
GO
-- 常用辅料(包装类)
SELECT TOP 12 存货编码, 存货名称, 计量单位, 仓库, 现存量 FROM v_stock_pick
 WHERE 现存量 > 50 AND 仓库='恒亿仓' AND (存货名称 LIKE '%袋%' OR 存货名称 LIKE '%膜%' OR 存货名称 LIKE '%标签%' OR 存货名称 LIKE '%圈%' OR 存货名称 LIKE '%布%') ORDER BY 现存量 DESC;
