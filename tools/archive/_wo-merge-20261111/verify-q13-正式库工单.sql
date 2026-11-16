SELECT COUNT(*) AS 总数 FROM dbo.plang WHERE pl_no LIKE N'GD-2026-11-00%';
SELECT TOP 10 id, pl_no, pl_xc, od_no, od_xc, dm, pl_sl, CONVERT(varchar(19), asp_time1, 120) AS t FROM dbo.plang WHERE pl_no LIKE N'GD-2026-11-00%' ORDER BY id DESC;
GO
SELECT TOP 5 单据编号, CONVERT(varchar(10), 单据日期,120) AS d FROM bd_so_order WHERE 单据编号 = N'ZL-20261016-01';
GO
