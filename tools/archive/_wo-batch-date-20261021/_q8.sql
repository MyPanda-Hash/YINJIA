SET NOCOUNT ON;
-- A) 已完成工单总量 + 批次号是否等于 单据日期+3 天
SELECT COUNT(*) AS 已完工行,
       SUM(CASE WHEN ISNULL([批次号],N'') = CONVERT(varchar(8), DATEADD(day,3,pl_date), 112) THEN 1 ELSE 0 END) AS 批次号已符合,
       SUM(CASE WHEN ISNULL([批次号],N'') <> CONVERT(varchar(8), DATEADD(day,3,pl_date), 112) THEN 1 ELSE 0 END) AS 批次号待改,
       MIN(CONVERT(varchar(10),pl_date,120)) AS 最早单据日期, MAX(CONVERT(varchar(10),pl_date,120)) AS 最晚单据日期
FROM dbo.plang WHERE ISNULL([完工状态],N'')=N'生产完工' AND ISNULL(asp_cancel,'N')<>'Y';
GO
-- B) 已完成工单里 pl_date 的时分秒分布 + 转单时间时分秒分布
SELECT CONVERT(varchar(8),pl_date,108) AS 单据日期时分秒, COUNT(*) AS n FROM dbo.plang
WHERE ISNULL([完工状态],N'')=N'生产完工' AND ISNULL(asp_cancel,'N')<>'Y' GROUP BY CONVERT(varchar(8),pl_date,108);
GO
SELECT CONVERT(varchar(8),asp_time1,108) AS 转单时分秒, COUNT(*) AS n FROM dbo.plang
WHERE ISNULL([完工状态],N'')=N'生产完工' AND ISNULL(asp_cancel,'N')<>'Y' GROUP BY CONVERT(varchar(8),asp_time1,108);
GO
-- C) 链路上带 批次号 且命中这些工单的行数
IF OBJECT_ID('tempdb..#w') IS NOT NULL DROP TABLE #w;
SELECT pl_no, pl_xc, id INTO #w FROM dbo.plang WHERE ISNULL([完工状态],N'')=N'生产完工' AND ISNULL(asp_cancel,'N')<>'Y';
GO
SELECT N'scjl' t, COUNT(*) n FROM dbo.scjl s JOIN #w w ON w.pl_no=s.gldh AND ISNULL(s.[工单行号],0)=w.pl_xc
UNION ALL SELECT N'bd_finish_in', COUNT(*) FROM dbo.bd_finish_in f JOIN #w w ON w.pl_no=f.[加工单号] AND ISNULL(f.[工单行号],0)=w.pl_xc
UNION ALL SELECT N'qc_first_insp_head', COUNT(*) FROM dbo.qc_first_insp_head h JOIN #w w ON w.pl_no=h.[工单号] AND ISNULL(h.[工单行号],0)=w.pl_xc
UNION ALL SELECT N'qc_proc_insp_head', COUNT(*) FROM dbo.qc_proc_insp_head h JOIN #w w ON w.pl_no=h.[工单号] AND ISNULL(h.[工单行号],0)=w.pl_xc
UNION ALL SELECT N'qc_asm_insp_head', COUNT(*) FROM dbo.qc_asm_insp_head h JOIN #w w ON w.pl_no=h.[工单号] AND ISNULL(h.[工单行号],0)=w.pl_xc
UNION ALL SELECT N'wo_progress', COUNT(*) FROM dbo.wo_progress p JOIN #w w ON w.pl_no=p.[单据编号] AND ISNULL(p.[工单行id],0)=w.id
UNION ALL SELECT N'plang_pc', COUNT(*) FROM dbo.plang_pc pc JOIN #w w ON w.id=pc.plang_id
UNION ALL SELECT N'inh', COUNT(*) FROM dbo.inh i JOIN #w w ON w.pl_no=i.[工单号]
UNION ALL SELECT N'outh', COUNT(*) FROM dbo.outh o JOIN #w w ON w.pl_no=o.[工单号];
GO
