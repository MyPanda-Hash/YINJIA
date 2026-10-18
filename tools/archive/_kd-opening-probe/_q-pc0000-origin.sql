-- PC0000 来源取证:MES 侧几类单据的批号形态分布(只读)
SET NOCOUNT ON;

PRINT N'=== ① 各类单据行的 批号 形态分布(MES 9/1 后)===';
SELECT 方向, 单据类型,
       SUM(CASE WHEN ISNULL(批号,'') = N'PC0000' THEN 1 ELSE 0 END) AS PC0000行,
       SUM(CASE WHEN ISNULL(批号,'') = N'' THEN 1 ELSE 0 END) AS 空批号行,
       SUM(CASE WHEN ISNULL(批号,'') NOT IN (N'PC0000',N'') THEN 1 ELSE 0 END) AS 其它批号行,
       COUNT(*) AS 总行数,
       SUM(CASE WHEN ISNULL(批号,'') = N'PC0000' THEN 数量 ELSE 0 END) AS PC0000数量
FROM (
  SELECT N'入库' AS 方向, 单据类型, 批号, 数量 FROM inh
   WHERE ISNULL(asp_cancel,'N') <> 'Y' AND 单据日期 >= '2026-09-01' AND src BETWEEN 1 AND 8
  UNION ALL
  SELECT N'出库', 单据类型, 批号, 数量 FROM outh
   WHERE ISNULL(asp_cancel,'N') <> 'Y' AND 单据日期 >= '2026-09-01'
) t
GROUP BY 方向, 单据类型 ORDER BY 方向, 单据类型;
GO

PRINT N'=== ② PC0000 最早出现在什么时候(按单据日期)===';
SELECT 方向, MIN(单据日期) AS 最早, MAX(单据日期) AS 最晚, COUNT(*) AS 行数 FROM (
  SELECT N'入库' AS 方向, 单据日期, 批号 FROM inh WHERE src BETWEEN 1 AND 8 AND ISNULL(asp_cancel,'N')<>'Y'
  UNION ALL
  SELECT N'出库', 单据日期, 批号 FROM outh WHERE ISNULL(asp_cancel,'N')<>'Y'
) t WHERE ISNULL(批号,'') = N'PC0000' GROUP BY 方向;
GO

PRINT N'=== ③ 材料出库单行的批号取值来源:界面录入 vs 扫码 ===';
SELECT TOP 20 单据编号, 物料编码, 批号, 数量, ISNULL(asp_user1,'') AS 录入人, CONVERT(varchar(19), asp_time1, 120) AS 录入时间
  FROM outh WHERE 单据类型 = N'材料出库单' AND ISNULL(asp_cancel,'N')<>'Y'
 ORDER BY id DESC;
GO

PRINT N'=== ④ 同物料同仓:入库批号 vs 出库批号 是否对得上(抽样)===';
WITH lots AS (
  SELECT 物料编码, 仓库编码,
         (SELECT COUNT(DISTINCT 批号) FROM inh i WHERE i.物料编码 = o.物料编码 AND i.仓库编码 = o.仓库编码
            AND ISNULL(i.asp_cancel,'N')<>'Y' AND ISNULL(i.批号,'')<>'PC0000') AS 入库批号数,
         COUNT(DISTINCT CASE WHEN ISNULL(批号,'') <> N'PC0000' THEN 批号 END) AS 出库非PC批号数
    FROM outh o WHERE ISNULL(o.asp_cancel,'N')<>'Y' AND o.单据类型 = N'材料出库单'
   GROUP BY 物料编码, 仓库编码
)
SELECT CASE WHEN 入库批号数 > 0 AND 出库非PC批号数 = 0 THEN N'A 有真实入库批号但出库全记PC0000'
            WHEN 入库批号数 > 0 AND 出库非PC批号数 > 0 THEN N'B 出入库批号都有'
            WHEN 入库批号数 = 0 THEN N'C 入库本身没有真实批号' END AS 情形,
       COUNT(*) AS 物料仓库组合数
  FROM lots GROUP BY CASE WHEN 入库批号数 > 0 AND 出库非PC批号数 = 0 THEN N'A 有真实入库批号但出库全记PC0000'
            WHEN 入库批号数 > 0 AND 出库非PC批号数 > 0 THEN N'B 出入库批号都有'
            WHEN 入库批号数 = 0 THEN N'C 入库本身没有真实批号' END;
GO
