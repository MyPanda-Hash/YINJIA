SET NOCOUNT ON;
GO
SELECT N'① 测试库 bs_inv 来料检验分布' AS 区块, ISNULL(来料检验, N'<NULL>') AS 来料检验, COUNT(*) AS 行数
FROM bs_inv GROUP BY 来料检验 ORDER BY 行数 DESC;
GO
SELECT N'② 测试库 暂收单(前 8)' AS 区块, r.单据编号, r.批次号, r.批次键, COUNT(d.id) AS 行数
FROM sl_recv r LEFT JOIN sl_recv_detail d ON d.单据编号 = r.单据编号
GROUP BY r.单据编号, r.批次号, r.批次键, r.id ORDER BY r.id DESC;
GO
SELECT N'③ 测试库 暂收单明细可分流情况' AS 区块, COUNT(*) AS 暂收明细行,
       SUM(CASE WHEN i.来料检验 = N'是' THEN 1 ELSE 0 END) AS 检验行,
       SUM(CASE WHEN ISNULL(i.来料检验, N'否') <> N'是' THEN 1 ELSE 0 END) AS 免检行
FROM sl_recv_detail d LEFT JOIN bs_inv i ON i.存货编码 = d.物料编码;
GO
SELECT N'④ 测试库 列存在性' AS 区块, COL_LENGTH('dbo.bs_inv', N'来料检验') AS bs_inv来料检验,
       COL_LENGTH('dbo.sl_recv', N'批次键') AS 暂收批次键, COL_LENGTH('dbo.bl_purchase_in', N'是否来料检验') AS 入库标志;
GO
