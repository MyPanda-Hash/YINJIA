SET NOCOUNT ON;
PRINT '=== plang 3221 ===';
SELECT id, pl_no, pl_xc, xq_sl, pl_sl, rk_sl, ISNULL([当前工序],N'') AS 当前工序,
       ISNULL([当前工序完工量],0) AS 当前工序完工量, ISNULL([工艺路线],N'') AS 工艺路线,
       ISNULL(scx,N'') AS scx
FROM dbo.plang WHERE id = 3221;

PRINT '=== wo_process_line 3221 ===';
SELECT id, 工序, 工序序, 计划数量, ISNULL(计划生产线,N'') AS 计划生产线,
       ISNULL(实际生产线,N'') AS 实际生产线, ISNULL(状态,N'') AS 状态
FROM dbo.wo_process_line
WHERE 工单行id = 3221 AND ISNULL(asp_cancel,'N') <> 'Y'
ORDER BY ISNULL(工序序,999), id;

PRINT '=== bs_route GY-2026-11-0003 ===';
SELECT 工序名称, 换算率, 加工顺序
FROM dbo.bs_route
WHERE 工艺路线编码 = N'GY-2026-11-0003' AND ISNULL(asp_cancel,'N') <> 'Y'
ORDER BY ISNULL(加工顺序,999);
