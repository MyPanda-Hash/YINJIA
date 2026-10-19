SET NOCOUNT ON;
SELECT TOP 10 单据编号, 材料编码, 材料名称, 计量单位, 数量, 库存数量, 商品是否多单位
FROM dbo.bl_material_out WHERE 材料编码 IN (N'HP-08', N'XH-SX80250SX', N'HS-150') ORDER BY id DESC;
PRINT N'-- 多单位标记统计 --';
SELECT ISNULL(商品是否多单位,N'(空)') AS 多单位标记, COUNT(*) AS 行数 FROM dbo.bl_material_out GROUP BY 商品是否多单位;
