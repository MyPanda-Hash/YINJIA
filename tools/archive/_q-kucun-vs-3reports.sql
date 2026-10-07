SET NOCOUNT ON;
-- 两本账的"重叠区":同一 (仓库编码, 存货编码) 两边都有 → 数字是否一致
SELECT k.仓库, k.存货, k.kucun结余, v.报表现存量, v.报表现存量 - k.kucun结余 AS 差额
FROM (SELECT ckdm AS 仓库, wzdm AS 存货, SUM(ISNULL(yl,0)) AS kucun结余
      FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY ckdm, wzdm) k
JOIN (SELECT 仓库编码 AS 仓库, 存货编码 AS 存货, SUM(现存量) AS 报表现存量
      FROM v_stock_balance GROUP BY 仓库编码, 存货编码) v
  ON v.仓库 = k.仓库 AND v.存货 = k.存货
ORDER BY ABS(v.报表现存量 - k.kucun结余) DESC;
GO
-- 三个报表视图的定义里有没有 kucun(应为 0);对照 v_wo_kit(应 >0)
SELECT o.name AS 对象, LEN(m.definition) AS 定义长度,
       CASE WHEN m.definition LIKE '%kucun%' THEN N'含 kucun' ELSE N'不含 kucun' END AS 扫描结果
FROM sys.sql_modules m JOIN sys.objects o ON o.object_id=m.object_id
WHERE o.name IN ('v_stock_ledger','v_stock_summary','v_stock_balance','v_stock_movement','inv_cost_ledger','v_wo_kit')
ORDER BY o.name;
GO
