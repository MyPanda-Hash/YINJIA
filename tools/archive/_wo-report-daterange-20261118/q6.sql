SET NOCOUNT ON;
SELECT TOP 12 CONVERT(char(7), sc_date, 120) AS ym, COUNT(*) AS n, SUM(sl) AS qty
FROM scjl WHERE ISNULL(comm,'N') <> 'Y' GROUP BY CONVERT(char(7), sc_date, 120) ORDER BY ym DESC;
GO
