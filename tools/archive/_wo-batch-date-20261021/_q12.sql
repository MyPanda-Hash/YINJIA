SET NOCOUNT ON;
IF OBJECT_ID('tempdb..#w') IS NOT NULL DROP TABLE #w;
SELECT id, pl_no, pl_xc, CAST(pl_date AS date) d INTO #w
FROM dbo.plang WHERE ISNULL([完工状态],N'')=N'生产完工' AND ISNULL(asp_cancel,'N')<>'Y';
GO
-- 报工:成型=+1 切炭=+2 组装=+3(允许工艺顺序差异,先看分布)
SELECT s.gxdm AS 工序,
       SUM(CASE WHEN CAST(s.sc_date AS date)=DATEADD(day,1,w.d) THEN 1 ELSE 0 END) AS 加1,
       SUM(CASE WHEN CAST(s.sc_date AS date)=DATEADD(day,2,w.d) THEN 1 ELSE 0 END) AS 加2,
       SUM(CASE WHEN CAST(s.sc_date AS date)=DATEADD(day,3,w.d) THEN 1 ELSE 0 END) AS 加3,
       SUM(CASE WHEN CAST(s.sc_date AS date) NOT IN (DATEADD(day,1,w.d),DATEADD(day,2,w.d),DATEADD(day,3,w.d)) THEN 1 ELSE 0 END) AS 其它,
       COUNT(*) AS 合计
FROM dbo.scjl s JOIN #w w ON w.pl_no=s.gldh AND ISNULL(s.[工单行号],0)=w.pl_xc
GROUP BY s.gxdm;
GO
-- 检验单/入库单:单据日期与 工单单据日期 的差值
SELECT N'qc_first_insp' t,
       SUM(CASE WHEN h.单据日期=DATEADD(day,1,w.d) THEN 1 ELSE 0 END) AS 加1,
       SUM(CASE WHEN h.单据日期=DATEADD(day,3,w.d) THEN 1 ELSE 0 END) AS 加3,
       SUM(CASE WHEN h.单据日期 NOT IN (DATEADD(day,1,w.d),DATEADD(day,3,w.d)) THEN 1 ELSE 0 END) AS 其它, COUNT(*) 合计
FROM dbo.qc_first_insp_head h JOIN #w w ON w.pl_no=h.工单号 AND ISNULL(h.工单行号,0)=w.pl_xc
UNION ALL
SELECT N'qc_proc_insp',
       SUM(CASE WHEN h.单据日期=DATEADD(day,1,w.d) THEN 1 ELSE 0 END),
       SUM(CASE WHEN h.单据日期=DATEADD(day,3,w.d) THEN 1 ELSE 0 END),
       SUM(CASE WHEN h.单据日期 NOT IN (DATEADD(day,1,w.d),DATEADD(day,3,w.d)) THEN 1 ELSE 0 END), COUNT(*)
FROM dbo.qc_proc_insp_head h JOIN #w w ON w.pl_no=h.工单号 AND ISNULL(h.工单行号,0)=w.pl_xc
UNION ALL
SELECT N'qc_asm_insp',
       SUM(CASE WHEN h.单据日期=DATEADD(day,1,w.d) THEN 1 ELSE 0 END),
       SUM(CASE WHEN h.单据日期=DATEADD(day,3,w.d) THEN 1 ELSE 0 END),
       SUM(CASE WHEN h.单据日期 NOT IN (DATEADD(day,1,w.d),DATEADD(day,3,w.d)) THEN 1 ELSE 0 END), COUNT(*)
FROM dbo.qc_asm_insp_head h JOIN #w w ON w.pl_no=h.工单号 AND ISNULL(h.工单行号,0)=w.pl_xc
UNION ALL
SELECT N'bd_finish_in',
       SUM(CASE WHEN f.单据日期=DATEADD(day,1,w.d) THEN 1 ELSE 0 END),
       SUM(CASE WHEN f.单据日期=DATEADD(day,3,w.d) THEN 1 ELSE 0 END),
       SUM(CASE WHEN f.单据日期 NOT IN (DATEADD(day,1,w.d),DATEADD(day,3,w.d)) THEN 1 ELSE 0 END), COUNT(*)
FROM dbo.bd_finish_in f JOIN #w w ON w.pl_no=f.[加工单号] AND ISNULL(f.[工单行号],0)=w.pl_xc;
GO
-- 报工单号日期段 vs 工单单据日期(报工单号是 BG-2026-09-xxxx,看是否错月)
SELECT TOP 10 w.pl_no, CONVERT(varchar(10),w.d,120) d, MIN(s.sc_no) 首报工单, MIN(CONVERT(varchar(10),s.sc_date,120)) 首报日期
FROM #w w JOIN dbo.scjl s ON s.gldh=w.pl_no AND ISNULL(s.[工单行号],0)=w.pl_xc
GROUP BY w.pl_no,w.d ORDER BY w.d DESC;
GO
