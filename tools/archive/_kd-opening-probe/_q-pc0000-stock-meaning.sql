-- 现状取证:PC0000(无批次)行在 MES 里的库存是怎么算的(只读)
SET NOCOUNT ON;

PRINT N'=== ① kucun 里 PC0000 行的规模 ===';
SELECT COUNT(*) AS PC0000行数,
       SUM(CASE WHEN yl > 0 THEN 1 ELSE 0 END) AS 正结存行,
       SUM(CASE WHEN yl < 0 THEN 1 ELSE 0 END) AS 负结存行,
       SUM(CASE WHEN yl = 0 THEN 1 ELSE 0 END) AS 零结存行,
       CAST(SUM(yl) AS decimal(18,2)) AS 余量合计
  FROM kucun WHERE ISNULL(asp_cancel,'N') <> 'Y' AND lot_no = N'PC0000';
GO

PRINT N'=== ② 负结存中 PC0000 占比 ===';
SELECT CASE WHEN lot_no = N'PC0000' THEN N'PC0000' ELSE N'其它批号' END AS 批号类别,
       COUNT(*) AS 负结存行数, CAST(SUM(yl) AS decimal(18,2)) AS 负余量合计
  FROM kucun WHERE ISNULL(asp_cancel,'N') <> 'Y' AND ISNULL(yl,0) < 0
 GROUP BY CASE WHEN lot_no = N'PC0000' THEN N'PC0000' ELSE N'其它批号' END;
GO

PRINT N'=== ③ 含 PC0000 行的物料仓库,按(物料,仓库)合计是否为正 ===';
WITH g AS (
  SELECT wzdm, ckdm,
         SUM(yl) AS 合计,
         SUM(CASE WHEN lot_no = N'PC0000' THEN yl ELSE 0 END) AS PC部分,
         SUM(CASE WHEN lot_no = N'PC0000' THEN 1 ELSE 0 END) AS PC行数
    FROM kucun WHERE ISNULL(asp_cancel,'N') <> 'Y'
   GROUP BY wzdm, ckdm
)
SELECT CASE WHEN 合计 > 0 AND PC部分 < 0 THEN N'A 总账为正但PC0000行为负'
            WHEN 合计 < 0 THEN N'B 总账本身为负'
            WHEN 合计 > 0 AND PC部分 >= 0 THEN N'C 总账为正且PC0000非负'
            ELSE N'D 其它' END AS 情形,
       COUNT(*) AS 物料仓库组合数,
       SUM(PC行数) AS 涉及PC行数
  FROM g WHERE PC行数 > 0
 GROUP BY CASE WHEN 合计 > 0 AND PC部分 < 0 THEN N'A 总账为正但PC0000行为负'
            WHEN 合计 < 0 THEN N'B 总账本身为负'
            WHEN 合计 > 0 AND PC部分 >= 0 THEN N'C 总账为正且PC0000非负'
            ELSE N'D 其它' END;
GO

PRINT N'=== ④ 按(物料,仓库)合计为负的组合 = 真缺货 ===';
WITH g AS (
  SELECT wzdm, ckdm, SUM(yl) AS 合计 FROM kucun WHERE ISNULL(asp_cancel,'N') <> 'Y' GROUP BY wzdm, ckdm
)
SELECT COUNT(*) AS 物料仓库组合为负, CAST(ISNULL(SUM(合计),0) AS decimal(18,2)) AS 缺口合计 FROM g WHERE 合计 < 0;
GO

PRINT N'=== ⑤ 负结存样例 ===';
SELECT TOP 10 wzdm, ckdm, ISNULL(lot_no,N'(空)') AS 批号, CAST(yl AS decimal(18,2)) AS 余量
  FROM kucun WHERE ISNULL(asp_cancel,'N') <> 'Y' AND ISNULL(yl,0) < 0
 ORDER BY yl;
GO
