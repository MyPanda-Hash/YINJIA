SET NOCOUNT ON;
SELECT '--- inh/outh 行数与 src 分布 ---' AS x;
SELECT 'inh' AS 表, src, COUNT(*) AS 行数, SUM(ISNULL(数量,0)) AS 数量合计 FROM inh GROUP BY src
UNION ALL
SELECT 'outh', src, COUNT(*), SUM(ISNULL(数量,0)) FROM outh GROUP BY src
ORDER BY 表, src;
SELECT '--- 流水总量 ---' AS x;
SELECT (SELECT COUNT(*) FROM inh) AS inh行, (SELECT COUNT(*) FROM outh) AS outh行, (SELECT COUNT(*) FROM kucun) AS kucun行;
SELECT '--- kucun 余量/来源 ---' AS x;
SELECT COUNT(*) AS 有效行, SUM(ISNULL(yl,0)) AS 余量合计 FROM kucun WHERE ISNULL(asp_cancel,'N') <> 'Y';
