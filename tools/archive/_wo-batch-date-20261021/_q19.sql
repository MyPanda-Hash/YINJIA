SET NOCOUNT ON;
IF OBJECT_ID('tempdb..#w') IS NOT NULL DROP TABLE #w;
SELECT p.id, p.pl_no, p.pl_xc, CAST(p.pl_date AS date) d, ISNULL(p.[批次号],N'') b
INTO #w FROM dbo.plang p
WHERE ISNULL(p.[完工状态],N'')=N'生产完工' AND ISNULL(p.asp_cancel,'N')<>'Y'
  AND ISNULL(p.ja,'N') IN (N'T',N'Y')
  AND ((ISNULL(p.pl_sl,0)>0 AND ISNULL(p.rk_sl,0)>=ISNULL(p.pl_sl,0)) OR p.pl_no LIKE N'GD2608%');
GO
SELECT COUNT(*) 行数, COUNT(DISTINCT pl_no) 工单数, COUNT(DISTINCT CAST(d AS varchar(10))) 日期数 FROM #w;
GO
-- (工单号,行号) 是否唯一
SELECT COUNT(*) 重复组 FROM (SELECT pl_no, pl_xc FROM #w GROUP BY pl_no, pl_xc HAVING COUNT(*)>1) x;
GO
-- 批次号分布
SELECT b AS 现批次号, COUNT(*) n FROM #w GROUP BY b ORDER BY n DESC;
GO
-- 链条行数与批号分布
SELECT N'scjl' t, COUNT(*) n, COUNT(DISTINCT ISNULL(s.[批次号],N'')) 批号种数 FROM dbo.scjl s JOIN #w w ON w.id=(SELECT TOP 1 pc.plang_id FROM dbo.plang_pc pc WHERE pc.id=s.gd_id)
UNION ALL SELECT N'plang_pc', COUNT(*), COUNT(DISTINCT ISNULL(pc.[批次号],N'')) FROM dbo.plang_pc pc JOIN #w w ON w.id=pc.plang_id
UNION ALL SELECT N'wo_progress', COUNT(*), COUNT(DISTINCT ISNULL(p.[批次号],N'')) FROM dbo.wo_progress p JOIN #w w ON w.id=p.[工单行id]
UNION ALL SELECT N'qc_first_insp_head', COUNT(*), COUNT(DISTINCT ISNULL(h.[批次号],N'')) FROM dbo.qc_first_insp_head h JOIN #w w ON w.pl_no=h.[工单号] AND w.pl_xc=ISNULL(h.[工单行号],0)
UNION ALL SELECT N'qc_proc_insp_head', COUNT(*), COUNT(DISTINCT ISNULL(h.[批次号],N'')) FROM dbo.qc_proc_insp_head h JOIN #w w ON w.pl_no=h.[工单号] AND w.pl_xc=ISNULL(h.[工单行号],0)
UNION ALL SELECT N'qc_asm_insp_head', COUNT(*), COUNT(DISTINCT ISNULL(h.[批次号],N'')) FROM dbo.qc_asm_insp_head h JOIN #w w ON w.pl_no=h.[工单号] AND w.pl_xc=ISNULL(h.[工单行号],0)
UNION ALL SELECT N'bd_finish_in', COUNT(*), COUNT(DISTINCT ISNULL(f.[批次号],N'')) FROM dbo.bd_finish_in f JOIN #w w ON w.pl_no=f.[加工单号] AND w.pl_xc=ISNULL(f.[工单行号],0);
GO
-- 入库行表
SELECT COUNT(*) 行表行数, COUNT(DISTINCT ISNULL(l.[批号],N'')) 批号种数, MIN(ISNULL(l.[批号],N'')) 样例
FROM dbo.bl_finish_in l JOIN dbo.bd_finish_in f ON f.[单据编号]=l.[单据编号]
JOIN #w w ON w.pl_no=f.[加工单号] AND w.pl_xc=ISNULL(f.[工单行号],0);
GO
-- 生产异常
SELECT COUNT(*) FROM dbo.bd_prod_abn a JOIN #w w ON w.pl_no=a.[工单号];
GO
