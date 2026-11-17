SELECT TOP 12 id, pl_no, pl_xc, ISNULL(od_no,N'<NULL>') AS od_no, od_xc, dm, mc, pl_sl, xq_sl, yl,
       CONVERT(varchar(19), asp_time1, 120) AS 创建时间, ISNULL([工艺路线],N'') AS 路线
FROM dbo.plang
WHERE pl_no = N'GD-2026-11-0002'
ORDER BY pl_xc;
GO
SELECT COUNT(*) AS 台账行数 FROM dbo.wo_process_line WHERE 工单号 = N'GD-2026-11-0002';
GO
SELECT TOP 8 工单号, 工单行id, 工序, 工序序, 计划数量, 状态 FROM dbo.wo_process_line WHERE 工单号 = N'GD-2026-11-0002' ORDER BY 工序序;
GO
