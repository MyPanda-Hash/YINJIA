SET NOCOUNT ON;
DECLARE @c TABLE(id int);
INSERT @c SELECT p.id FROM dbo.plang p
WHERE ISNULL(p.asp_cancel,'N')<>'Y' AND ISNULL(p.[完工状态],N'')=N'生产完工'
  AND ISNULL(p.ja,'N') IN (N'T',N'Y')
  AND ((ISNULL(p.pl_sl,0)>0 AND ISNULL(p.rk_sl,0)>=ISNULL(p.pl_sl,0)) OR p.pl_no LIKE N'GD2608%');
SELECT N'已结案工单行' k, COUNT(*) n FROM @c
UNION ALL SELECT N'其中批号=单据日期+3', COUNT(*) FROM dbo.plang p JOIN @c c ON c.id=p.id
  WHERE ISNULL(p.[批次号],N'')=CONVERT(varchar(8),DATEADD(day,3,CAST(p.pl_date AS date)),112)
UNION ALL SELECT N'其中转单日期=单据日期', COUNT(*) FROM dbo.plang p JOIN @c c ON c.id=p.id
  WHERE CAST(p.asp_time1 AS date)=CAST(p.pl_date AS date)
UNION ALL SELECT N'未结案仍带旧批号行(未动)', COUNT(*) FROM dbo.plang p
  WHERE p.id NOT IN (SELECT id FROM @c) AND ISNULL(p.[批次号],N'')=N'20261014'
UNION ALL SELECT N'链路批号已同步行合计', (SELECT COUNT(*) FROM dbo.scjl s JOIN dbo.plang_pc pc ON pc.id=s.gd_id JOIN @c c ON c.id=pc.plang_id)
  + (SELECT COUNT(*) FROM dbo.wo_progress w JOIN @c c ON c.id=w.[工单行id])
  + (SELECT COUNT(*) FROM dbo.qc_first_insp_head h JOIN dbo.plang p ON p.pl_no=h.[工单号] AND ISNULL(p.pl_xc,0)=ISNULL(h.[工单行号],0) JOIN @c c ON c.id=p.id)
  + (SELECT COUNT(*) FROM dbo.qc_proc_insp_head h JOIN dbo.plang p ON p.pl_no=h.[工单号] AND ISNULL(p.pl_xc,0)=ISNULL(h.[工单行号],0) JOIN @c c ON c.id=p.id)
  + (SELECT COUNT(*) FROM dbo.qc_asm_insp_head h JOIN dbo.plang p ON p.pl_no=h.[工单号] AND ISNULL(p.pl_xc,0)=ISNULL(h.[工单行号],0) JOIN @c c ON c.id=p.id)
  + (SELECT COUNT(*) FROM dbo.bd_finish_in f JOIN dbo.plang p ON p.pl_no=f.[加工单号] AND ISNULL(p.pl_xc,0)=ISNULL(f.[工单行号],0) JOIN @c c ON c.id=p.id)
  + (SELECT COUNT(*) FROM dbo.plang_pc pc JOIN @c c ON c.id=pc.plang_id);
GO
