SET NOCOUNT ON;
SELECT CASE WHEN COL_LENGTH('dbo.bs_inv', N'商品类型') IS NOT NULL THEN 1 ELSE 0 END AS has_col;
SELECT TOP 8 存货编码, LEFT(存货名称,14) AS 名称, 商品类型 FROM bs_inv WHERE ISNULL(商品类型,'')<>'' ORDER BY id;
SELECT 商品类型, COUNT(*) AS n FROM bs_inv GROUP BY 商品类型;
