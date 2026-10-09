SET NOCOUNT ON;
SELECT N'--- 商品档案规模与关键编码 ---' AS s;
SELECT COUNT(*) AS 商品总数 FROM bs_inv;
SELECT COUNT(*) AS B族数量 FROM bs_inv WHERE 存货编码 LIKE N'B-%';
SELECT 存货编码, 存货名称, 规格型号, 计量单位, 数据来源 FROM bs_inv
WHERE 存货编码 IN (N'B-47-29', N'YJ-SX-031', N'C-95-13');
