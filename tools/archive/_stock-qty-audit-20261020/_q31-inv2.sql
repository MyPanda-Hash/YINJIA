SET NOCOUNT ON;
SELECT 存货编码, 计量单位, 是否多单位, 多单位, 采购单位, 库存单位, 单位换算率, 换算率1, 辅助单位
FROM dbo.bs_inv WHERE 存货编码 IN (N'HP-08',N'XH-SX80250SX',N'HS-150',N'XC-2040');
