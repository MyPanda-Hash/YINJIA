SET NOCOUNT ON;
SELECT COUNT(*) AS 命中行数 FROM dbo.bs_inv
WHERE ISNULL(asp_cancel,'N')='Y' AND asp_user2=N'admin'
  AND asp_time2 >= '2026-10-03 19:07:10' AND asp_time2 < '2026-10-03 19:07:11';
GO
-- 反查:同一操作人、同一分钟内的其它删除行(确保窗口不误伤/不遗漏)
SELECT CONVERT(varchar(23), asp_time2, 121) AS 删除时刻, COUNT(*) AS 行数
FROM dbo.bs_inv WHERE ISNULL(asp_cancel,'N')='Y' AND asp_user2=N'admin'
GROUP BY CONVERT(varchar(23), asp_time2, 121) ORDER BY 删除时刻;
GO
