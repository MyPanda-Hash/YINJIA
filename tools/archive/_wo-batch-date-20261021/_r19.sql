SET NOCOUNT ON;
SELECT c.name AS col, ty.name AS typ FROM sys.columns c JOIN sys.types ty ON ty.user_type_id=c.user_type_id
WHERE c.object_id=OBJECT_ID('dbo.s_allno') ORDER BY c.column_id;
GO
SELECT TOP 10 * FROM dbo.s_allno WHERE dh IN (SELECT pl_no FROM dbo.plang WHERE pl_no=N'GD-2026-10-0004');
GO
SELECT COUNT(*) AS 九月号段已有 FROM dbo.s_allno WHERE dh LIKE N'GD-2026-09-%';
GO
SELECT TOP 5 * FROM dbo.s_allno WHERE dh LIKE N'GD-2026-09-%';
GO
SELECT s.id, s.sc_no, s.gldh, s.[工单行号], ISNULL(s.[批次号],N'') 批次号, s.asp_cancel
FROM dbo.scjl s WHERE s.sc_no LIKE N'GD-2026-10-%';
GO
