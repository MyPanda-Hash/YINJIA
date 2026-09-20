SET NOCOUNT ON;
SELECT TOP 3 存货编码, LEFT(存货名称,10) AS 名称, 商品类型, 来料检验 FROM bs_inv ORDER BY id;
