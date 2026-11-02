SET NOCOUNT ON;
DECLARE @c TABLE(id int,pl_no nvarchar(56),pl_xc int);
INSERT @c SELECT p.id,p.pl_no,ISNULL(p.pl_xc,0) FROM dbo.plang p
WHERE ISNULL(p.asp_cancel,'N')<>'Y' AND ISNULL(p.[完工状态],N'')=N'生产完工'
  AND ISNULL(p.ja,'N') IN (N'T',N'Y')
  AND ((ISNULL(p.pl_sl,0)>0 AND ISNULL(p.rk_sl,0)>=ISNULL(p.pl_sl,0)) OR p.pl_no LIKE N'GD2608%');
SELECT N'plang_pc' t, COUNT(*) n, SUM(CASE WHEN ISNULL(pc.[批次号],N'')=CONVERT(varchar(8),DATEADD(day,3,CAST(p.pl_date AS date)),112) THEN 1 ELSE 0 END) 符合
FROM dbo.plang_pc pc JOIN dbo.plang p ON p.id=pc.plang_id JOIN @c c ON c.id=p.id
UNION ALL SELECT N'scjl', COUNT(*), SUM(CASE WHEN ISNULL(s.[批次号],N'')=CONVERT(varchar(8),DATEADD(day,3,CAST(p.pl_date AS date)),112) THEN 1 ELSE 0 END)
FROM dbo.scjl s JOIN dbo.plang_pc pc ON pc.id=s.gd_id JOIN dbo.plang p ON p.id=pc.plang_id JOIN @c c ON c.id=p.id
UNION ALL SELECT N'wo_progress', COUNT(*), SUM(CASE WHEN ISNULL(w.[批次号],N'')=CONVERT(varchar(8),DATEADD(day,3,CAST(p.pl_date AS date)),112) THEN 1 ELSE 0 END)
FROM dbo.wo_progress w JOIN dbo.plang p ON p.id=w.[工单行id] JOIN @c c ON c.id=p.id
UNION ALL SELECT N'qc_first', COUNT(*), SUM(CASE WHEN ISNULL(h.[批次号],N'')=CONVERT(varchar(8),DATEADD(day,3,CAST(p.pl_date AS date)),112) THEN 1 ELSE 0 END)
FROM dbo.qc_first_insp_head h JOIN dbo.plang p ON p.pl_no=h.[工单号] AND ISNULL(p.pl_xc,0)=ISNULL(h.[工单行号],0) JOIN @c c ON c.id=p.id
UNION ALL SELECT N'qc_proc', COUNT(*), SUM(CASE WHEN ISNULL(h.[批次号],N'')=CONVERT(varchar(8),DATEADD(day,3,CAST(p.pl_date AS date)),112) THEN 1 ELSE 0 END)
FROM dbo.qc_proc_insp_head h JOIN dbo.plang p ON p.pl_no=h.[工单号] AND ISNULL(p.pl_xc,0)=ISNULL(h.[工单行号],0) JOIN @c c ON c.id=p.id
UNION ALL SELECT N'qc_asm', COUNT(*), SUM(CASE WHEN ISNULL(h.[批次号],N'')=CONVERT(varchar(8),DATEADD(day,3,CAST(p.pl_date AS date)),112) THEN 1 ELSE 0 END)
FROM dbo.qc_asm_insp_head h JOIN dbo.plang p ON p.pl_no=h.[工单号] AND ISNULL(p.pl_xc,0)=ISNULL(h.[工单行号],0) JOIN @c c ON c.id=p.id
UNION ALL SELECT N'bd_finish_in', COUNT(*), SUM(CASE WHEN ISNULL(f.[批次号],N'')=CONVERT(varchar(8),DATEADD(day,3,CAST(p.pl_date AS date)),112) THEN 1 ELSE 0 END)
FROM dbo.bd_finish_in f JOIN dbo.plang p ON p.pl_no=f.[加工单号] AND ISNULL(p.pl_xc,0)=ISNULL(f.[工单行号],0) JOIN @c c ON c.id=p.id
UNION ALL SELECT N'bl_finish_in', COUNT(*), SUM(CASE WHEN ISNULL(l.[批号],N'')=CONVERT(varchar(8),DATEADD(day,3,CAST(p.pl_date AS date)),112) THEN 1 ELSE 0 END)
FROM dbo.bl_finish_in l JOIN dbo.bd_finish_in f ON f.[单据编号]=l.[单据编号] JOIN dbo.plang p ON p.pl_no=f.[加工单号] AND ISNULL(p.pl_xc,0)=ISNULL(f.[工单行号],0) JOIN @c c ON c.id=p.id;
GO
SELECT N'scjl.lot_no 旧批号' t, COUNT(*) n FROM dbo.scjl WHERE ISNULL(lot_no,N'')=N'20261014'
UNION ALL SELECT N'plang_pc.lot_no 旧批号', COUNT(*) FROM dbo.plang_pc WHERE ISNULL(lot_no,N'')=N'20261014'
UNION ALL SELECT N'其它未结案 scjl 旧批号', COUNT(*) FROM dbo.scjl s WHERE ISNULL(s.[批次号],N'')=N'20261014';
GO
