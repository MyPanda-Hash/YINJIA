SET NOCOUNT ON;
SELECT COUNT(*) AS 同rid多物料组合数 FROM (
  SELECT src, rid FROM dbo.outh WHERE rid IS NOT NULL GROUP BY src, rid HAVING COUNT(DISTINCT ISNULL(物料编码,N'')) > 1
) t;
SELECT COUNT(*) AS 物料编码为空的行 FROM dbo.outh WHERE ISNULL(物料编码,N'') = N'';
SELECT COUNT(*) AS 批号为空的行 FROM dbo.outh WHERE 批号 IS NULL;
SELECT TOP 10 src, rid, COUNT(*) AS 行数 FROM dbo.outh WHERE rid IS NOT NULL GROUP BY src, rid ORDER BY COUNT(*) DESC;
