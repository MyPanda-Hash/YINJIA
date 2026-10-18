-- 负库存溯源:kucun 里的负结存由哪些流水造成(只读)
SET NOCOUNT ON;

PRINT N'=== ① 负结存行的流水明细(取最负的 5 个键)===';
WITH neg AS (
  SELECT TOP 5 wzdm, ckdm, lot_no, yl FROM kucun
   WHERE ISNULL(asp_cancel,'N') <> 'Y' AND ISNULL(yl,0) < 0 ORDER BY yl
)
SELECT n.wzdm, n.ckdm, ISNULL(n.lot_no,N'(空)') AS lot, CAST(n.yl AS decimal(18,2)) AS 余量,
       f.方向, f.单据类型, f.单据编号, CONVERT(varchar(10), f.单据日期, 120) AS 单据日期,
       CAST(f.数量 AS decimal(18,2)) AS 数量, ISNULL(f.批号,N'(空)') AS 流水批号
  FROM neg n
  CROSS APPLY (
    SELECT N'入' AS 方向, 单据类型, 单据编号, 单据日期, 数量, 批号 FROM inh
     WHERE RTRIM(物料编码)=RTRIM(n.wzdm) AND RTRIM(仓库编码)=RTRIM(n.ckdm) AND ISNULL(asp_cancel,'N')<>'Y'
    UNION ALL
    SELECT N'出', 单据类型, 单据编号, 单据日期, -数量, 批号 FROM outh
     WHERE RTRIM(物料编码)=RTRIM(n.wzdm) AND RTRIM(仓库编码)=RTRIM(n.ckdm) AND ISNULL(asp_cancel,'N')<>'Y'
  ) f
 ORDER BY n.yl, f.单据日期;
GO

PRINT N'=== ② 批号口径:负结存行 vs 同物料同仓其他批号 ===';
SELECT TOP 20 k.wzdm, k.ckdm, ISNULL(k.lot_no,N'(空)') AS 该批号, CAST(k.yl AS decimal(18,2)) AS 该批余量,
       SUM(CAST(k2.yl AS decimal(18,2))) AS 同物料同仓总余量, COUNT(k2.id) AS 同仓行数
  FROM kucun k
  JOIN kucun k2 ON k2.wzdm = k.wzdm AND k2.ckdm = k.ckdm AND ISNULL(k2.asp_cancel,'N') <> 'Y'
 WHERE ISNULL(k.asp_cancel,'N') <> 'Y' AND ISNULL(k.yl,0) < 0
 GROUP BY k.wzdm, k.ckdm, k.lot_no, k.yl
 HAVING SUM(k2.yl) > 0
 ORDER BY k.yl;
GO

PRINT N'=== ③ 负结存里,批号为空 vs 有批号 ===';
SELECT CASE WHEN lot_no IS NULL OR RTRIM(lot_no) = '' THEN N'批号为空' ELSE N'有批号' END AS 批号,
       COUNT(*) AS 行数, CAST(SUM(yl) AS decimal(18,2)) AS 余量合计
  FROM kucun WHERE ISNULL(asp_cancel,'N') <> 'Y' AND ISNULL(yl,0) < 0
 GROUP BY CASE WHEN lot_no IS NULL OR RTRIM(lot_no) = '' THEN N'批号为空' ELSE N'有批号' END;
GO

PRINT N'=== ④ 有批号为空 vs PC0000 的负结存 ===';
SELECT ISNULL(NULLIF(RTRIM(lot_no),N''),N'(空)') AS 批号, COUNT(*) AS 行数
  FROM kucun WHERE ISNULL(asp_cancel,'N') <> 'Y' AND ISNULL(yl,0) < 0
 GROUP BY ISNULL(NULLIF(RTRIM(lot_no),N''),N'(空)') ORDER BY COUNT(*) DESC;
GO
