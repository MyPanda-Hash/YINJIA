SELECT p.id, p.pl_no, p.pl_xc, ISNULL(p.dm,N'') AS 产品, ISNULL(p.mc,N'') AS 品名,
       ISNULL(p.scx,N'<null>') AS 产线, ISNULL(p.[完工状态],N'<null>') AS 完工状态,
       CONVERT(varchar(19), p.[完工时间], 120) AS 完工时间,
       ISNULL(p.[当前工序],N'<null>') AS 当前工序, ISNULL(p.ja,N'<null>') AS ja,
       ISNULL(p.pl_sl,0) AS 排产, ISNULL(p.rk_sl,0) AS 入库, ISNULL(p.xq_sl,0) AS 需求,
       CONVERT(varchar(19), p.pl_date, 120) AS 计划日, CONVERT(varchar(19), p.asp_time1, 120) AS 建单时间,
       CONVERT(varchar(19), p.asp_time2, 120) AS 改单时间
FROM dbo.plang p WHERE p.pl_no=N'GD-2026-10-0223'
GO
SELECT COUNT(*) AS 报工笔数, ISNULL(SUM(ISNULL(sl,0)),0) AS 报工量,
       ISNULL(SUM(CASE WHEN ISNULL(wgzt,'N')='Y' THEN ISNULL(sl,0) ELSE 0 END),0) AS 已审量
FROM dbo.scjl WHERE gldh=N'GD-2026-10-0223'
GO
SELECT ISNULL(gxdm,N'') AS 工序, ISNULL(wgzt,'') AS 审核, ISNULL(sl,0) AS 数量,
       CONVERT(varchar(19), ISNULL(wgsj, asp_time1), 120) AS 时间
FROM dbo.scjl WHERE gldh=N'GD-2026-10-0223' ORDER BY id DESC
GO
SELECT COUNT(*) AS 预排台账 FROM dbo.wo_process_line WHERE 工单号=N'GD-2026-10-0223'
GO
SELECT COUNT(*) AS 首件单 FROM dbo.qc_first_insp_head WHERE 工单号=N'GD-2026-10-0223' AND ISNULL(asp_cancel,'N')<>'Y'
GO
