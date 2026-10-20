SET NOCOUNT ON;
SELECT COUNT(*) AS 工单行总数 FROM dbo.plang;
GO
SELECT COUNT(DISTINCT p.id) AS rid已被历史流水占用的工单行数
  FROM dbo.plang p JOIN dbo.outh o ON o.src = 6 AND o.rid = p.id;
GO
SELECT TOP 15 p.pl_no, p.pl_xc, p.id AS 工单行id, o.单据编号 AS 占用单据, o.物料编码, o.批号
  FROM dbo.plang p JOIN dbo.outh o ON o.src = 6 AND o.rid = p.id
 ORDER BY o.id DESC;
GO
SELECT COUNT(*) AS 同一工单行rid被多行占用的个数 FROM (
  SELECT o.rid FROM dbo.outh o JOIN dbo.plang p ON p.id = o.rid WHERE o.src = 6
  GROUP BY o.rid HAVING COUNT(*) > 1) t;
