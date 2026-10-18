SELECT TOP 30 pl_no, pl_xc, ja, [完工状态] AS done, pl_sl, rk_sl, ISNULL([当前工序],N'') AS cur, ISNULL(scx,N'') AS line,
       CONVERT(varchar(19), asp_time2, 120) AS t2, CONVERT(varchar(19), asp_time1, 120) AS t1
FROM dbo.plang
WHERE ISNULL(asp_cancel,'N')<>'Y'
ORDER BY asp_time2 DESC, asp_time1 DESC;
