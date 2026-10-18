SELECT ISNULL(ja,'(null)') AS ja, COUNT(*) AS n FROM dbo.plang WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY ISNULL(ja,'(null)');
SELECT TOP 10 pl_no, pl_xc, ja, CONVERT(varchar(19),asp_time2,120) AS t2, asp_user2 FROM dbo.plang WHERE ISNULL(ja,'N') IN ('Y','T') ORDER BY asp_time2 DESC;
SELECT c.name, t.name AS type, c.max_length FROM sys.columns c JOIN sys.types t ON t.user_type_id=c.user_type_id WHERE c.object_id=OBJECT_ID('dbo.plang') AND c.name IN ('ja','pl_no','pl_xc','asp_time2','asp_user2');
