SET NOCOUNT ON;
SELECT 'plang行数' AS what, COUNT(*) AS cnt FROM plang;
GO
SELECT 'plang-asp_cancel分布' AS what, ISNULL(asp_cancel,'<NULL>') AS v, COUNT(*) AS cnt FROM plang GROUP BY asp_cancel ORDER BY cnt DESC;
GO
SELECT 'distinct dm 全部' AS what, COUNT(DISTINCT dm) AS cnt FROM plang;
GO
SELECT 'distinct dm 非Y' AS what, COUNT(DISTINCT dm) AS cnt FROM plang WHERE ISNULL(asp_cancel,'') <> 'Y';
GO
SELECT 'distinct dm 非Y且非空' AS what, COUNT(DISTINCT dm) AS cnt FROM plang WHERE ISNULL(asp_cancel,'') <> 'Y' AND NULLIF(LTRIM(RTRIM(dm)),'') IS NOT NULL;
GO
SELECT 'distinct dm 仅asp_cancel为NULL' AS what, COUNT(DISTINCT dm) AS cnt FROM plang WHERE asp_cancel IS NULL AND NULLIF(LTRIM(RTRIM(dm)),'') IS NOT NULL;
GO
SELECT 'distinct dm 非Y(清单)' AS what, dm FROM plang WHERE ISNULL(asp_cancel,'') <> 'Y' AND NULLIF(LTRIM(RTRIM(dm)),'') IS NOT NULL GROUP BY dm ORDER BY dm;
GO
