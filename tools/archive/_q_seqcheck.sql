SET NOCOUNT ON;
SELECT TOP 8 o.单据编号, o.单据状态, COUNT(l.id) AS 行数
FROM bd_pu_order o JOIN bl_pu_order l ON l.单据编号 = o.单据编号
WHERE ISNULL(l.行号,N'') <> N'' AND o.单据状态 = N'已审核'
GROUP BY o.单据编号, o.单据状态 ORDER BY o.单据编号 DESC;
GO
SELECT o.单据编号, l.行号, l.物料编码, l.数量 FROM bd_pu_order o JOIN bl_pu_order l ON l.单据编号 = o.单据编号
WHERE o.单据编号 IN (SELECT TOP 8 单据编号 FROM bl_pu_order WHERE ISNULL(行号,N'')<>N'' GROUP BY 单据编号 ORDER BY 单据编号 DESC)
ORDER BY o.单据编号 DESC, l.id;
GO
