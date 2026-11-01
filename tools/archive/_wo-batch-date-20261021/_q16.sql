SET NOCOUNT ON;
IF OBJECT_ID('tempdb..#w') IS NOT NULL DROP TABLE #w;
SELECT id, pl_no, pl_xc INTO #w FROM dbo.plang
WHERE ISNULL([完工状态],N'')=N'生产完工' AND ISNULL(asp_cancel,'N')<>'Y';
GO
SELECT COUNT(*) 排产行, SUM(CASE WHEN p.id IS NULL THEN 1 ELSE 0 END) plang_id悬空
FROM dbo.plang_pc pc JOIN #w w ON w.pl_no=pc.pl_no AND w.pl_xc=pc.pl_xc
LEFT JOIN dbo.plang p ON p.id=pc.plang_id;
GO
SELECT COUNT(*) scjl行, SUM(CASE WHEN ISNULL(s.gd_id,0)=0 THEN 1 ELSE 0 END) 无gd_id,
       SUM(CASE WHEN ISNULL(s.gd_id,0)>0 AND pc2.id IS NULL THEN 1 ELSE 0 END) 未锚定
FROM dbo.scjl s JOIN #w w ON w.pl_no=s.gldh AND ISNULL(s.[工单行号],0)=w.pl_xc
LEFT JOIN dbo.plang_pc pc2 ON pc2.id=s.gd_id AND pc2.plang_id=w.id;
GO
SELECT COUNT(*) 报工未锚定明细 FROM dbo.scjl s JOIN #w w ON w.pl_no=s.gldh AND ISNULL(s.[工单行号],0)=w.pl_xc
LEFT JOIN dbo.plang_pc pc2 ON pc2.id=s.gd_id AND pc2.plang_id=w.id
WHERE ISNULL(s.gd_id,0)>0 AND pc2.id IS NULL;
GO
