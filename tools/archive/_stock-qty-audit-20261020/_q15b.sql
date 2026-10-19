SET NOCOUNT ON;
PRINT N'== 单据行 现存量 为负的样本 ==';
SELECT TOP 10 N'bl_pu_order' AS [表], 单据编号, 物料编码 AS [存货], 仓库, 数量, 现存量, asp_user1, asp_time1
FROM dbo.bl_pu_order WHERE 现存量 < -0.0001 ORDER BY 现存量;
PRINT N'-- bl_sale_out --';
SELECT TOP 10 N'bl_sale_out' AS [表], 单据编号, 存货编码 AS [存货], 数量, 现存量, asp_user1, asp_time1
FROM dbo.bl_sale_out WHERE 现存量 < -0.0001 ORDER BY 现存量;

PRINT N'== 单据行 现存量 取值来源分布(非空行 asp_user1) ==';
SELECT ISNULL(asp_user1,N'(空)') AS 录入人, COUNT(*) AS 行数, COUNT(现存量) AS 有现存量
FROM dbo.bl_pu_order GROUP BY asp_user1 ORDER BY COUNT(*) DESC;
