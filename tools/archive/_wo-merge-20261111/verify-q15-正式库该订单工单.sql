SELECT TOP 20 id, pl_no, pl_xc, od_no, od_xc, dm, pl_sl, CONVERT(varchar(19), asp_time1, 120) AS t, ISNULL(asp_cancel,'N') AS cancel
FROM dbo.plang WHERE od_no = N'ZL-20261016-01' ORDER BY id;
GO
