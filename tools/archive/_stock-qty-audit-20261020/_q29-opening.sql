SET NOCOUNT ON;
PRINT N'== 期初结存行 按计量单位 ==';
SELECT 计量单位, COUNT(*) AS 行数, CAST(SUM(收入数量) AS decimal(18,4)) AS 数量合计
FROM dbo.v_stock_movement WHERE src=0 GROUP BY 计量单位 ORDER BY 数量合计 DESC;

PRINT N'== 期初行里单位为 g 的明细 ==';
SELECT 单据编号, 仓库编码, 存货编码, 存货, 计量单位, CAST(收入数量 AS decimal(18,4)) AS 期初数量
FROM dbo.v_stock_movement WHERE src=0 AND 计量单位=N'g' ORDER BY 收入数量 DESC;

PRINT N'== 期初总量 vs 剔除 g 单位后的总量 ==';
SELECT CAST(SUM(收入数量) AS decimal(18,4)) AS 期初合计,
       CAST(SUM(CASE WHEN 计量单位=N'g' THEN 收入数量 ELSE 0 END) AS decimal(18,4)) AS 其中g单位,
       CAST(SUM(CASE WHEN 计量单位=N'g' THEN 收入数量/1000.0 ELSE 收入数量 END) AS decimal(18,4)) AS 若g按kg折算
FROM dbo.v_stock_movement WHERE src=0;
