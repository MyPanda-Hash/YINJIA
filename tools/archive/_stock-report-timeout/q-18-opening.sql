/* q-18-opening.sql — 期初结存还在不在?流水与结存缓存对不对得上(只读) */
SET NOCOUNT ON;
GO
SELECT N'inh 按 src' AS k, src, COUNT(*) AS 行数, MIN(单据日期) AS 最早, MAX(单据日期) AS 最晚,
       SUM(CASE WHEN ISNULL(asp_cancel,'N')='Y' THEN 1 ELSE 0 END) AS 已作废
FROM dbo.inh GROUP BY src ORDER BY src;
GO
SELECT N'outh 按 src' AS k, src, COUNT(*) AS 行数, MIN(单据日期) AS 最早, MAX(单据日期) AS 最晚,
       SUM(CASE WHEN ISNULL(asp_cancel,'N')='Y' THEN 1 ELSE 0 END) AS 已作废
FROM dbo.outh GROUP BY src ORDER BY src;
GO
SELECT N'流水净额 vs 结存缓存' AS k,
       (SELECT CAST(SUM(数量) AS decimal(18,2)) FROM dbo.inh WHERE ISNULL(asp_cancel,'N')<>'Y') AS inh数量,
       (SELECT CAST(SUM(数量) AS decimal(18,2)) FROM dbo.outh WHERE ISNULL(asp_cancel,'N')<>'Y') AS outh数量,
       (SELECT CAST(SUM(yl) AS decimal(18,2)) FROM dbo.kucun WHERE ISNULL(asp_cancel,'N')<>'Y') AS kucun现存量合计,
       (SELECT COUNT(*) FROM dbo.kucun WHERE ISNULL(asp_cancel,'N')<>'Y') AS kucun行数;
GO
SELECT TOP 8 wzdm AS 物料, ckdm AS 仓库, lot_no AS 批号, rkl, ckl, yl
FROM dbo.kucun WHERE ISNULL(asp_cancel,'N')<>'Y' AND yl > 0 ORDER BY yl DESC;
GO
