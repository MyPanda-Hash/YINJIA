SET NOCOUNT ON;
SELECT p.id AS 工单行id, p.pl_no, p.pl_xc, p.mc, p.pl_sl
  FROM dbo.plang p
 WHERE NOT EXISTS (SELECT 1 FROM dbo.outh o WHERE o.src = 6 AND o.rid = p.id)
 ORDER BY p.id DESC;
GO
SELECT COUNT(*) AS 撞号工单行数 FROM dbo.plang p WHERE EXISTS (SELECT 1 FROM dbo.outh o WHERE o.src = 6 AND o.rid = p.id);
