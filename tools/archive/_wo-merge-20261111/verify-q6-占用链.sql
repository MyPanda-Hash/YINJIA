SELECT TOP 12 id, pl_no, pl_xc, od_no, od_xc, dm, mc, pl_sl, xq_sl, yl,
       CONVERT(varchar(19), asp_time1, 120) AS 创建时间, ISNULL([工艺路线],N'') AS 路线, ISNULL(asp_cancel,'N') AS 作废
FROM dbo.plang
WHERE od_no = N'ZL-20261016-01' AND id > 8700
ORDER BY id DESC;
GO
SELECT TOP 12 source_form_no, source_line_key, target_form_no, target_line_key, linked_quantity,
       CONVERT(varchar(19), create_time, 120) AS 创建时间
FROM dbo.form_flow_link
WHERE source_form_no = N'ZL-20261016-01' AND target_form_no LIKE N'GD-2026-11-%'
ORDER BY id DESC;
GO
SELECT TOP 12 l.工单号, l.工单行id, l.工序, l.工序序, l.计划数量, l.状态
FROM dbo.wo_process_line l JOIN dbo.plang p ON p.id = l.工单行id
WHERE p.od_no = N'ZL-20261016-01' AND p.id > 8700
ORDER BY l.工单号, l.工序序;
GO
