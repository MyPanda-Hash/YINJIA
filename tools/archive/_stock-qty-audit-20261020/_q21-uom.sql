SET NOCOUNT ON;
PRINT N'== 1. 采购入库行: 计量单位= g 的样本(含 实收数量2/换算率) ==';
SELECT TOP 10 单据编号, 存货编码, 存货名称, 计量单位, 实收数量, 计量单位2, 实收数量2, 换算率, 单价
FROM dbo.bl_purchase_in WHERE 计量单位 = N'g' OR 计量单位2 = N'g' ORDER BY 实收数量 DESC;

PRINT N'== 2. 这些存货在基础档案里的计量单位 ==';
SELECT TOP 10 存货编码, 存货名称, 规格型号, 计量单位 FROM dbo.bs_inv
WHERE 存货编码 IN (SELECT TOP 10 存货编码 FROM dbo.bl_purchase_in WHERE 计量单位 = N'g' ORDER BY 实收数量 DESC);

PRINT N'== 3. 采购入库行 实收数量 与 实收数量2*换算率 是否一致(有辅单位的行) ==';
SELECT COUNT(*) AS 有辅单位行,
       SUM(CASE WHEN ISNULL(换算率,0)>0 AND ABS(ISNULL(实收数量,0)-ISNULL(实收数量2,0)*换算率) > 0.01 THEN 1 ELSE 0 END) AS 不一致行
FROM dbo.bl_purchase_in WHERE ISNULL(实收数量2,0) <> 0;
