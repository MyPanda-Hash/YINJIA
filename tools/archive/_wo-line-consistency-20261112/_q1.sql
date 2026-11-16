SET NOCOUNT ON;
PRINT '=== 1. 各线 plang_pc 当前线口径(未结案未完工) ===';
SELECT pc.scx AS 线, COUNT(*) AS 行数, SUM(ISNULL(p.pl_sl,0)) AS 排产合计, SUM(ISNULL(p.rk_sl,0)) AS 入库合计
FROM dbo.plang_pc pc
JOIN dbo.plang p ON p.comm=pc.comm AND p.pl_no=pc.pl_no AND p.pl_xc=pc.pl_xc AND pc.plang_id=p.id AND ISNULL(p.asp_cancel,'N')<>'Y'
WHERE ISNULL(pc.asp_cancel,'N')<>'Y' AND ISNULL(pc.scx,N'')<>N''
GROUP BY pc.scx ORDER BY pc.scx;

PRINT '=== 2. 各线 台账(wo_process_line)口径 ===';
SELECT COALESCE(NULLIF(w.实际生产线,N''),NULLIF(w.计划生产线,N'')) AS 线,
       ISNULL(w.状态,N'') AS 状态, COUNT(*) AS 行数, SUM(ISNULL(w.计划数量,0)) AS 计划合计
FROM dbo.wo_process_line w
JOIN dbo.plang p ON p.id=w.工单行id AND ISNULL(p.asp_cancel,'N')<>'Y'
WHERE ISNULL(w.asp_cancel,'N')<>'Y'
GROUP BY COALESCE(NULLIF(w.实际生产线,N''),NULLIF(w.计划生产线,N'')), ISNULL(w.状态,N'')
ORDER BY 线, 状态;

PRINT '=== 3. 装箱2(新厂) 台账明细 ===';
SELECT w.id, w.工单号, w.工单行id, w.工序, w.工序序, w.计划数量, ISNULL(w.状态,N'') AS 状态,
       ISNULL(w.计划生产线,N'') AS 计划线, ISNULL(w.实际生产线,N'') AS 实际线,
       ISNULL(p.pl_xc,0) AS 工单行号, ISNULL(p.pl_sl,0) AS 排产数量, ISNULL(p.rk_sl,0) AS 入库数量
FROM dbo.wo_process_line w
JOIN dbo.plang p ON p.id=w.工单行id AND ISNULL(p.asp_cancel,'N')<>'Y'
WHERE ISNULL(w.asp_cancel,'N')<>'Y'
  AND (w.实际生产线=N'装箱2(新厂)' OR (ISNULL(w.实际生产线,N'')=N'' AND w.计划生产线=N'装箱2(新厂)'))
ORDER BY w.工单号, w.工单行id, ISNULL(w.工序序,999);

PRINT '=== 4. 装箱2(新厂) plang_pc 当前线行 ===';
SELECT pc.pl_no, pc.pl_xc, p.id AS 行id, p.pl_sl, p.rk_sl, ISNULL(p.[当前工序],N'') AS 当前工序, ISNULL(p.[完工状态],N'') AS 完工状态
FROM dbo.plang_pc pc
JOIN dbo.plang p ON p.comm=pc.comm AND p.pl_no=pc.pl_no AND p.pl_xc=pc.pl_xc AND pc.plang_id=p.id AND ISNULL(p.asp_cancel,'N')<>'Y'
WHERE ISNULL(pc.asp_cancel,'N')<>'Y' AND pc.scx=N'装箱2(新厂)' ORDER BY pc.pl_no, pc.pl_xc;
