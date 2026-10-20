SET NOCOUNT ON;
SELECT src, COUNT(*) AS 行数, MIN(id) AS 最小id, MAX(id) AS 最大id, MIN(asp_time1) AS 最早, MAX(asp_time1) AS 最近
  FROM dbo.outh GROUP BY src ORDER BY src;
