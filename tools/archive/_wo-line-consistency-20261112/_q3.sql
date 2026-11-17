SET NOCOUNT ON;
PRINT '=== GD-2026-10-0003 行123 行数据 ===';
SELECT p.id, p.pl_no, p.pl_xc, p.pl_sl, p.rk_sl, p.xq_sl, ISNULL(p.[工艺路线],N'') AS 路线,
       ISNULL(p.[当前工序],N'') AS 当前工序, ISNULL(p.[完工状态],N'') AS 完工状态
FROM dbo.plang p WHERE p.pl_no=N'GD-2026-10-0003' AND p.id=123;

PRINT '=== 该行路线(bs_route) ===';
SELECT r.工序名称, r.加工顺序, r.换算率 FROM dbo.bs_route r
WHERE r.工艺路线编码 = (SELECT TOP 1 ISNULL(p.[工艺路线],N'') FROM dbo.plang p WHERE p.id=123)
  AND ISNULL(r.asp_cancel,'N')<>'Y' ORDER BY r.加工顺序;

PRINT '=== 该行台账 ===';
SELECT w.id, w.工序, w.工序序, w.计划数量, ISNULL(w.状态,N'') AS 状态,
       ISNULL(w.计划生产线,N'') AS 计划线, ISNULL(w.实际生产线,N'') AS 实际线
FROM dbo.wo_process_line w WHERE w.工单行id=123 AND ISNULL(w.asp_cancel,'N')<>'Y' ORDER BY ISNULL(w.工序序,999);

PRINT '=== 该行报工(scjl) ===';
SELECT s.报工单号, s.gldh, s.gxdm, s.sl, ISNULL(s.wgzt,N'') AS wgzt, ISNULL(s.asp_cancel,N'') AS cancel,
       ISNULL(s.[批次号],N'') AS 批次, ISNULL(s.gd_id,0) AS gd_id
FROM dbo.scjl s WHERE s.gldh=N'GD-2026-10-0003' AND ISNULL(s.asp_cancel,'N')<>'Y';

PRINT '=== GD-2026-09-0049 台账 ===';
SELECT w.id, w.工单号, w.工单行id, w.工序, w.计划数量, ISNULL(w.状态,N'') AS 状态,
       ISNULL(w.计划生产线,N'') AS 计划线, ISNULL(w.实际生产线,N'') AS 实际线
FROM dbo.wo_process_line w WHERE w.工单号=N'GD-2026-09-0049' ORDER BY w.工单行id, ISNULL(w.工序序,999);
