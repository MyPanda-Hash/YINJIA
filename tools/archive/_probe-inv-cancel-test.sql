SET NOCOUNT ON;
SELECT DB_NAME() AS 库, COUNT(*) AS 总行数,
       SUM(CASE WHEN ISNULL(asp_cancel,'N')<>'Y' THEN 1 ELSE 0 END) AS 存活行数,
       SUM(CASE WHEN ISNULL(asp_cancel,'N')='Y' AND asp_user2='admin' THEN 1 ELSE 0 END) AS admin软删行数
FROM dbo.bs_inv;
GO
SELECT ISNULL(asp_user2,'(null)') AS 软删人, CONVERT(varchar(19), asp_time2, 120) AS 软删时间, COUNT(*) AS 行数
FROM dbo.bs_inv WHERE ISNULL(asp_cancel,'N')='Y'
GROUP BY ISNULL(asp_user2,'(null)'), CONVERT(varchar(19), asp_time2, 120) ORDER BY 软删时间 DESC;
GO
