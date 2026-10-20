SET NOCOUNT ON;
PRINT '=== 今天 13:00 之后被"打印留痕"的工单行 ===';
SELECT comm, pl_no, pl_xc, [批次号], asp_print AS 打印次数, [打印人], [打印时间]
FROM dbo.plang
WHERE [打印时间] >= '2026-10-19T13:00:00'
ORDER BY [打印时间] DESC;
GO
PRINT '=== 按分钟统计打印留痕 ===';
SELECT CONVERT(varchar(16), [打印时间], 120) AS 分钟, COUNT(*) AS 行数
FROM dbo.plang
WHERE [打印时间] >= '2026-10-19T12:00:00'
GROUP BY CONVERT(varchar(16), [打印时间], 120)
ORDER BY 分钟 DESC;
GO
PRINT '=== 最近 20 条打印留痕(不限今天) ===';
SELECT TOP 20 comm, pl_no, pl_xc, asp_print AS 打印次数, [打印人], [打印时间]
FROM dbo.plang
WHERE [打印时间] IS NOT NULL
ORDER BY [打印时间] DESC;
GO
