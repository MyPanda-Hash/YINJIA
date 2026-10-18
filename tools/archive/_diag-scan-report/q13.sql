SELECT ISNULL(asp_user2,N'(null)') AS u2, COUNT(*) AS n FROM dbo.plang WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY ISNULL(asp_user2,N'(null)');
SELECT CONVERT(varchar(19),asp_time2,120) AS t2, COUNT(*) AS n FROM dbo.plang WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY CONVERT(varchar(19),asp_time2,120) ORDER BY n DESC;
