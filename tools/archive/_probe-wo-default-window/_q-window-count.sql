-- 一次性探针(2026-10-05):生产工单列表默认窗口(今天-14 ~ 今天)命中多少行
SELECT
  (SELECT COUNT(*) FROM dbo.plang WHERE ISNULL(asp_cancel,'N') <> 'Y') AS 全量行数,
  (SELECT COUNT(*) FROM dbo.plang WHERE ISNULL(asp_cancel,'N') <> 'Y'
     AND pl_date >= DATEADD(day, -14, CAST(GETDATE() AS date))) AS 默认近15天行数,
  (SELECT COUNT(DISTINCT pl_no) FROM dbo.plang WHERE ISNULL(asp_cancel,'N') <> 'Y') AS 全量工单数,
  (SELECT COUNT(DISTINCT pl_no) FROM dbo.plang WHERE ISNULL(asp_cancel,'N') <> 'Y'
     AND pl_date >= DATEADD(day, -14, CAST(GETDATE() AS date))) AS 默认窗口工单数,
  CONVERT(varchar(10), DATEADD(day, -14, CAST(GETDATE() AS date)), 120) AS 窗口起,
  CONVERT(varchar(10), CAST(GETDATE() AS date), 120) AS 窗口止;
