SET NOCOUNT ON;
IF OBJECT_ID('tempdb..#w') IS NOT NULL DROP TABLE #w;
SELECT DISTINCT pl_no INTO #w FROM dbo.plang WHERE ISNULL([完工状态],N'')=N'生产完工' AND ISNULL(asp_cancel,'N')<>'Y';
GO
SELECT p.pl_no AS 工单号, p.pl_xc AS 行, CONVERT(varchar(10), p.pl_date,120) AS 单据日期,
       CONVERT(varchar(10), p.asp_time1,120) AS 转单日期, ISNULL(p.[批次号],N'') AS 批次号,
       CONVERT(varchar(19), p.[完工时间],120) AS 完工时间,
       (SELECT COUNT(*) FROM dbo.scjl s WHERE s.gldh=p.pl_no AND ISNULL(s.[工单行号],0)=p.pl_xc) AS 报工行,
       (SELECT CONVERT(varchar(10),MIN(s.sc_date),120) FROM dbo.scjl s WHERE s.gldh=p.pl_no AND ISNULL(s.[工单行号],0)=p.pl_xc) AS 报工起,
       (SELECT CONVERT(varchar(10),MAX(s.sc_date),120) FROM dbo.scjl s WHERE s.gldh=p.pl_no AND ISNULL(s.[工单行号],0)=p.pl_xc) AS 报工止,
       (SELECT COUNT(*) FROM dbo.bd_finish_in f WHERE f.[加工单号]=p.pl_no AND ISNULL(f.[工单行号],0)=p.pl_xc) AS 入库单,
       (SELECT COUNT(*) FROM dbo.qc_first_insp_head h WHERE h.[工单号]=p.pl_no AND ISNULL(h.[工单行号],0)=p.pl_xc) AS 首检,
       (SELECT COUNT(*) FROM dbo.qc_proc_insp_head h WHERE h.[工单号]=p.pl_no AND ISNULL(h.[工单行号],0)=p.pl_xc) AS 制检,
       (SELECT COUNT(*) FROM dbo.qc_asm_insp_head h WHERE h.[工单号]=p.pl_no AND ISNULL(h.[工单行号],0)=p.pl_xc) AS 组检
FROM dbo.plang p JOIN #w w ON w.pl_no=p.pl_no
WHERE ISNULL(p.asp_cancel,'N')<>'Y'
ORDER BY p.id;
GO
