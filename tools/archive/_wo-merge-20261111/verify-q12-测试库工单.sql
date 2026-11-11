SELECT COUNT(*) AS 总数 FROM dbo.plang WHERE pl_no LIKE N'GD-2026-11-00%';
SELECT TOP 10 id, pl_no, pl_xc, od_no, od_xc, dm, pl_sl FROM dbo.plang WHERE pl_no LIKE N'GD-2026-11-00%' ORDER BY id DESC;
GO
