SET NOCOUNT ON;
DECLARE @m TABLE(old_no nvarchar(56), new_no nvarchar(56));
INSERT @m SELECT DISTINCT p.pl_no, N'GD-2026-09-' + RIGHT(p.pl_no,4)
FROM dbo.plang p
WHERE ISNULL(p.asp_cancel,'N')<>'Y' AND ISNULL(p.[完工状态],N'')=N'生产完工'
  AND ISNULL(p.ja,'N') IN (N'T',N'Y')
  AND ((ISNULL(p.pl_sl,0)>0 AND ISNULL(p.rk_sl,0)>=ISNULL(p.pl_sl,0)) OR p.pl_no LIKE N'GD2608%')
  AND CAST(p.pl_date AS date) >= '2026-09-01' AND CAST(p.pl_date AS date) < '2026-10-01';
SELECT COUNT(*) 待改工单号 FROM @m;
SELECT m.old_no, m.new_no, (SELECT COUNT(*) FROM dbo.plang x WHERE x.pl_no=m.new_no) AS plang已有,
       (SELECT COUNT(*) FROM dbo.scjl s WHERE s.gldh=m.new_no) AS scjl已有,
       (SELECT COUNT(*) FROM dbo.qc_first_insp_head h WHERE h.[工单号]=m.new_no)
      +(SELECT COUNT(*) FROM dbo.qc_proc_insp_head h WHERE h.[工单号]=m.new_no)
      +(SELECT COUNT(*) FROM dbo.qc_asm_insp_head h WHERE h.[工单号]=m.new_no) AS 检验已有,
       (SELECT COUNT(*) FROM dbo.bd_finish_in f WHERE f.[加工单号]=m.new_no) AS 入库已有
FROM @m m WHERE EXISTS (SELECT 1 FROM dbo.plang x WHERE x.pl_no=m.new_no)
   OR EXISTS (SELECT 1 FROM dbo.scjl s WHERE s.gldh=m.new_no)
   OR EXISTS (SELECT 1 FROM dbo.bd_finish_in f WHERE f.[加工单号]=m.new_no)
   OR EXISTS (SELECT 1 FROM dbo.qc_first_insp_head h WHERE h.[工单号]=m.new_no)
   OR EXISTS (SELECT 1 FROM dbo.qc_proc_insp_head h WHERE h.[工单号]=m.new_no)
   OR EXISTS (SELECT 1 FROM dbo.qc_asm_insp_head h WHERE h.[工单号]=m.new_no);
GO
