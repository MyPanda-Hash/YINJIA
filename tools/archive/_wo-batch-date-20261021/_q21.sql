SET NOCOUNT ON;
IF OBJECT_ID('tempdb..#w') IS NOT NULL DROP TABLE #w;
SELECT p.id, p.pl_no, p.pl_xc, CAST(p.pl_date AS date) d INTO #w FROM dbo.plang p
WHERE ISNULL(p.[完工状态],N'')=N'生产完工' AND ISNULL(p.asp_cancel,'N')<>'Y'
  AND ISNULL(p.ja,'N') IN (N'T',N'Y')
  AND ((ISNULL(p.pl_sl,0)>0 AND ISNULL(p.rk_sl,0)>=ISNULL(p.pl_sl,0)) OR p.pl_no LIKE N'GD2608%')
  AND ISNULL(p.[批次号],N'')=N'20261014';
GO
SELECT ISNULL(s.gd_ph,N'(null)') gd_ph, ISNULL(s.lot_no,N'(null)') lot_no, ISNULL(s.[批次号],N'(null)') batch, COUNT(*) n
FROM dbo.scjl s JOIN dbo.plang_pc pc ON pc.id=s.gd_id JOIN #w w ON w.id=pc.plang_id
GROUP BY s.gd_ph, s.lot_no, s.[批次号];
GO
SELECT ISNULL(l.[批号],N'(null)') 批号, COUNT(*) n
FROM dbo.bl_finish_in l JOIN dbo.bd_finish_in f ON f.[单据编号]=l.[单据编号]
JOIN #w w ON w.pl_no=f.[加工单号] AND w.pl_xc=ISNULL(f.[工单行号],0)
GROUP BY l.[批号];
GO
SELECT ISNULL(f.[单据类型],N'') 单据类型, ISNULL(f.[单据状态],N'') 状态, COUNT(*) n
FROM dbo.bd_finish_in f JOIN #w w ON w.pl_no=f.[加工单号] AND w.pl_xc=ISNULL(f.[工单行号],0)
GROUP BY f.[单据类型], f.[单据状态];
GO
