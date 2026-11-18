SET NOCOUNT ON;
PRINT '=== 台账工序 × 产线车间 分布(未完工/未取消) ===';
SELECT w.工序,
       ISNULL(pl.生产车间, N'(产线档案无)') AS 产线车间,
       COUNT(*) AS 行数,
       SUM(ISNULL(w.计划数量,0)) AS 计划合计
FROM dbo.wo_process_line w
LEFT JOIN dbo.bs_prod_line pl
       ON pl.生产线 = COALESCE(NULLIF(w.实际生产线,N''), NULLIF(w.计划生产线,N''))
      AND ISNULL(pl.asp_cancel,'N') <> 'Y'
WHERE ISNULL(w.asp_cancel,'N') <> 'Y'
  AND ISNULL(w.状态,N'') <> N'已完工'
GROUP BY w.工序, ISNULL(pl.生产车间, N'(产线档案无)')
ORDER BY w.工序, 行数 DESC;

PRINT '=== 4号车间 台账明细(未完工,前 20) ===';
SELECT TOP 20 w.id, w.工单行id, p.pl_no, w.工序, w.工序序, w.计划数量,
       ISNULL(w.计划生产线,N'') AS 计划生产线, ISNULL(w.实际生产线,N'') AS 实际生产线, w.状态
FROM dbo.wo_process_line w
LEFT JOIN dbo.plang p ON p.id = w.工单行id
WHERE ISNULL(w.asp_cancel,'N') <> 'Y'
  AND (ISNULL(w.实际生产线,N'') = N'4号车间' OR ISNULL(w.计划生产线,N'') = N'4号车间')
ORDER BY w.id;
