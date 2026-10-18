-- PC0000 → 无批号 归一 的影响面评估(只读)
SET NOCOUNT ON;

PRINT N'=== ① 各表里 PC0000 的分布 ===';
SELECT N'kucun' AS t, COUNT(*) AS 行数, CAST(SUM(yl) AS decimal(18,2)) AS 数量 FROM kucun
 WHERE ISNULL(asp_cancel,'N')<>'Y' AND RTRIM(lot_no)=N'PC0000'
UNION ALL
SELECT N'inh', COUNT(*), CAST(SUM(数量) AS decimal(18,2)) FROM inh
 WHERE ISNULL(asp_cancel,'N')<>'Y' AND RTRIM(批号)=N'PC0000'
UNION ALL
SELECT N'outh', COUNT(*), CAST(SUM(数量) AS decimal(18,2)) FROM outh
 WHERE ISNULL(asp_cancel,'N')<>'Y' AND RTRIM(批号)=N'PC0000';
GO

PRINT N'=== ② 归一后会与"已存在的无批号行"合并的键有多少 ===';
SELECT COUNT(*) AS 会合并的键数 FROM (
  SELECT wzdm, ckdm FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y'
   GROUP BY wzdm, ckdm
  HAVING SUM(CASE WHEN RTRIM(lot_no)=N'PC0000' THEN 1 ELSE 0 END) > 0
     AND SUM(CASE WHEN lot_no IS NULL OR RTRIM(lot_no)='' THEN 1 ELSE 0 END) > 0
) t;
GO

PRINT N'=== ③ 归一前后:按(物料,仓库)合计不变(必须为 0 差)===';
SELECT CAST(SUM(CASE WHEN RTRIM(lot_no)=N'PC0000' THEN yl ELSE 0 END) AS decimal(18,2)) AS PC0000数量,
       (SELECT CAST(SUM(yl) AS decimal(18,2)) FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y') AS 全表数量
  FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y';
GO

PRINT N'=== ④ 归一后 kucun 行数变化预测 ===';
SELECT COUNT(*) AS 归一前行数,
       COUNT(DISTINCT CONCAT(wzdm,'|',ckdm,'|',CASE WHEN RTRIM(lot_no)=N'PC0000' THEN '' ELSE ISNULL(RTRIM(lot_no),'') END)) AS 归一后行数
  FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y';
GO

PRINT N'=== ⑤ 单据行上的批号形态(需不需要一起归一)===';
SELECT ISNULL(NULLIF(RTRIM(批号),N''),N'(空)') AS 批号形态, COUNT(*) AS 行数 FROM (
  SELECT 批号 FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y'
  UNION ALL SELECT 批号 FROM outh WHERE ISNULL(asp_cancel,'N')<>'Y'
) t GROUP BY ISNULL(NULLIF(RTRIM(批号),N''),N'(空)') ORDER BY COUNT(*) DESC;
GO
