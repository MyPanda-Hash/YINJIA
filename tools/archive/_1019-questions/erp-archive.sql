SET NOCOUNT ON;
GO
PRINT '=== dm_gf(供应商档案)列 ==='
GO
SELECT name, TYPE_NAME(user_type_id) AS 类型, max_length FROM sys.columns WHERE object_id = OBJECT_ID('dbo.dm_gf') ORDER BY column_id;
GO
PRINT '=== dm_gf 行数 & 前 10 ==='
GO
SELECT COUNT(*) AS 供应商数 FROM dm_gf WHERE ISNULL(asp_cancel, 'N') <> 'Y';
GO
SELECT TOP 10 * FROM dm_gf;
GO
PRINT '=== bs_wh(仓库档案)列 ==='
GO
SELECT name, TYPE_NAME(user_type_id) AS 类型, max_length FROM sys.columns WHERE object_id = OBJECT_ID('dbo.bs_wh') ORDER BY column_id;
GO
PRINT '=== bs_wh 前 10 行 ==='
GO
SELECT TOP 10 * FROM bs_wh;
GO
PRINT '=== qc_return.供应商 与 dm_gf.mc/dm 的命中情况 ==='
GO
SELECT TOP 30 h.单据编号, h.供应商,
       (SELECT TOP 1 g.dm FROM dm_gf g WHERE g.mc = h.供应商) AS 按名称解析到的编码,
       (SELECT TOP 1 g.mc FROM dm_gf g WHERE g.dm = h.供应商) AS 按编码反查到的名称
FROM qc_return h
WHERE ISNULL(h.asp_cancel, 'N') <> 'Y'
ORDER BY h.单据编号 DESC;
GO
PRINT '=== qc_return.仓库 与 bs_wh 的命中情况 ==='
GO
SELECT h.仓库, COUNT(*) AS 单据数,
       (SELECT TOP 1 w.仓库编码 FROM bs_wh w WHERE w.仓库名称 = h.仓库) AS 解析到的仓库编码
FROM qc_return h
WHERE ISNULL(h.asp_cancel, 'N') <> 'Y'
GROUP BY h.仓库
ORDER BY 单据数 DESC;
GO
PRINT '=== qc_return_detail.计量单位 在 bs_uom 的命中(单位名称/单位编码) ==='
GO
SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('dbo.bs_uom') ORDER BY column_id;
GO
SELECT d.计量单位, COUNT(*) AS 行数 FROM qc_return_detail d GROUP BY d.计量单位 ORDER BY 行数 DESC;
GO
