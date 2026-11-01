SET NOCOUNT ON;
SELECT COUNT(*) AS plang九月号现有 FROM dbo.plang WHERE pl_no LIKE N'GD-2026-09-%';
SELECT COUNT(*) AS plang九月号现有_含作废 FROM dbo.plang WHERE pl_no LIKE N'GD-2026-09-%';
SELECT TOP 10 pl_no FROM dbo.plang WHERE pl_no LIKE N'GD-2026-09-%';
GO
SELECT COUNT(*) AS s_allno_GD行 FROM dbo.s_allno WHERE dh LIKE N'GD-%';
SELECT TOP 10 dh, ny FROM dbo.s_allno WHERE dh LIKE N'GD-%' ORDER BY dh DESC;
GO
