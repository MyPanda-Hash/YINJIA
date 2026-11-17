SET NOCOUNT ON;
PRINT '=== A. 两行的 plang_pc 当前线 ===';
SELECT pc.pl_no, pc.pl_xc, pc.scx AS 当前线, p.id AS 行id, p.pl_sl, p.rk_sl,
       ISNULL(p.[当前工序],N'') AS 当前工序, ISNULL(p.[完工状态],N'') AS 完工状态, ISNULL(p.ja,N'') AS ja
FROM dbo.plang_pc pc
JOIN dbo.plang p ON p.comm=pc.comm AND p.pl_no=pc.pl_no AND p.pl_xc=pc.pl_xc AND pc.plang_id=p.id
WHERE pc.pl_no IN (N'GD-2026-10-0003', N'GD-2026-11-0012') AND ISNULL(pc.asp_cancel,'N')<>'Y'
ORDER BY pc.pl_no, pc.pl_xc;

PRINT '=== B. 装箱2(新厂) 已落实台账行的报工(按道) ===';
SELECT w.工单号, w.工单行id, w.工序, w.计划数量, ISNULL(w.状态,N'') AS 状态,
       (SELECT SUM(ISNULL(s.sl,0)) FROM dbo.scjl s
         WHERE s.gldh=w.工单号 AND s.gxdm=w.工序 AND ISNULL(s.asp_cancel,'N')<>'Y' AND ISNULL(s.wgzt,'N')='Y'
           AND EXISTS (SELECT 1 FROM dbo.plang_pc pcx WHERE pcx.id=s.gd_id AND pcx.plang_id=w.工单行id)) AS 已审报工
FROM dbo.wo_process_line w
WHERE ISNULL(w.asp_cancel,'N')<>'Y' AND ISNULL(w.状态,N'')=N'已落实'
  AND COALESCE(NULLIF(w.实际生产线,N''),NULLIF(w.计划生产线,N''))=N'装箱2(新厂)'
ORDER BY w.工单号;

PRINT '=== C. 各线：本线工序(台账已落实)按线汇总(不含当前线口径) ===';
SELECT COALESCE(NULLIF(w.实际生产线,N''),NULLIF(w.计划生产线,N'')) AS 线,
       COUNT(*) AS 行数, SUM(ISNULL(w.计划数量,0)) AS 计划合计
FROM dbo.wo_process_line w
JOIN dbo.plang p ON p.id=w.工单行id AND ISNULL(p.asp_cancel,'N')<>'Y'
WHERE ISNULL(w.asp_cancel,'N')<>'Y' AND ISNULL(w.状态,N'')=N'已落实'
GROUP BY COALESCE(NULLIF(w.实际生产线,N''),NULLIF(w.计划生产线,N'')) ORDER BY 线;

PRINT '=== D. 各线：本工序已审报工量(按台账线归集) ===';
SELECT 线, SUM(已审报工) AS 已报合计 FROM (
  SELECT COALESCE(NULLIF(w.实际生产线,N''),NULLIF(w.计划生产线,N'')) AS 线,
         (SELECT SUM(ISNULL(s.sl,0)) FROM dbo.scjl s
           WHERE s.gldh=w.工单号 AND s.gxdm=w.工序 AND ISNULL(s.asp_cancel,'N')<>'Y' AND ISNULL(s.wgzt,'N')='Y'
             AND EXISTS (SELECT 1 FROM dbo.plang_pc pcx WHERE pcx.id=s.gd_id AND pcx.plang_id=w.工单行id)) AS 已审报工
  FROM dbo.wo_process_line w
  JOIN dbo.plang p ON p.id=w.工单行id AND ISNULL(p.asp_cancel,'N')<>'Y'
  WHERE ISNULL(w.asp_cancel,'N')<>'Y' AND ISNULL(w.状态,N'') IN (N'已落实',N'已完工')
) t GROUP BY 线 ORDER BY 线;
