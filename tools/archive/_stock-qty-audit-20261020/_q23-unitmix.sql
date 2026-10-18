SET NOCOUNT ON;
PRINT N'== 1. 基础档案的单位(与流水/期初的单位对比) ==';
SELECT 存货编码, 存货名称, 计量单位, 规格型号 FROM dbo.bs_inv
WHERE 存货编码 IN (N'HP-08', N'HS-150', N'HS-2040', N'CL002', N'C-78-31', N'YJ-JPL-005');

PRINT N'== 2. 同一(仓库,存货) 出现两种单位时,各单位的净存量 ==';
WITH u AS (
  SELECT 仓库编码, 存货编码, COUNT(DISTINCT ISNULL(主计量,N'(空)')) AS units
  FROM dbo.v_stock_balance GROUP BY 仓库编码, 存货编码
)
SELECT b.仓库编码, b.存货编码, b.存货, b.主计量, CAST(b.现存量 AS decimal(18,4)) AS 现存量
FROM dbo.v_stock_balance b JOIN u ON u.仓库编码=b.仓库编码 AND u.存货编码=b.存货编码
WHERE u.units > 1
ORDER BY b.存货编码, b.主计量;

PRINT N'== 3. 首页「现存量 TOP」口径效果(跨仓库按存货 SUM,不分单位) ==';
SELECT TOP 8 b.存货 AS 存货, b.存货编码,
       CAST(SUM(b.现存量) AS decimal(18,4)) AS 合计数量,
       COUNT(*) AS 行数,
       COUNT(DISTINCT ISNULL(b.主计量,N'(空)')) AS 单位数
FROM dbo.v_stock_balance b GROUP BY b.存货编码, b.存货
ORDER BY SUM(b.现存量) DESC;
