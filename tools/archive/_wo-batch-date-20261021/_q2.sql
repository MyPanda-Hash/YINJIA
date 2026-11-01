SET NOCOUNT ON;
-- 1) 己完工工单链路上的单据分布(按表 + 命中行数)
DECLARE @w TABLE(pl_no nvarchar(56));
INSERT @w SELECT DISTINCT pl_no FROM dbo.plang WHERE ISNULL([完工状态],N'')=N'生产完工' AND ISNULL(asp_cancel,'N')<>'Y';

SELECT N'scjl' t, COUNT(*) n FROM dbo.scjl s JOIN @w w ON w.pl_no=s.gldh
UNION ALL SELECT N'bd_finish_in', COUNT(*) FROM dbo.bd_finish_in f JOIN @w w ON w.pl_no=f.[加工单号]
UNION ALL SELECT N'wo_progress', COUNT(*) FROM dbo.wo_progress p JOIN @w w ON w.pl_no=p.[单据编号]
UNION ALL SELECT N'qc_first_insp_head', COUNT(*) FROM dbo.qc_first_insp_head h JOIN @w w ON w.pl_no=h.[工单号]
UNION ALL SELECT N'qc_proc_insp_head', COUNT(*) FROM dbo.qc_proc_insp_head h JOIN @w w ON w.pl_no=h.[工单号]
UNION ALL SELECT N'qc_asm_insp_head', COUNT(*) FROM dbo.qc_asm_insp_head h JOIN @w w ON w.pl_no=h.[工单号]
UNION ALL SELECT N'bl_finish_in', COUNT(*) FROM dbo.bl_finish_in f JOIN @w w ON w.pl_no=f.[工单号];
GO
-- 2) 时间类列(名字里带日期/时间)
SELECT t.name AS tbl, c.name AS col, ty.name AS typ
FROM sys.columns c JOIN sys.tables t ON t.object_id=c.object_id JOIN sys.types ty ON ty.user_type_id=c.user_type_id
WHERE t.name IN ('scjl','bd_finish_in','bl_finish_in','wo_progress','qc_first_insp_head','qc_proc_insp_head','qc_asm_insp_head','inh','outh')
  AND (c.name LIKE N'%日期%' OR c.name LIKE N'%时间%' OR c.name LIKE N'%sj%' OR c.name LIKE N'%date%')
ORDER BY t.name, c.column_id;
GO
