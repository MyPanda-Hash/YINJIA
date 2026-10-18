SET NOCOUNT ON;
PRINT '=== 备份表中 PC0000 相关行(char补空格实证) ===';
SELECT TOP 5 '['+lot_no+']' AS lot_raw, LEN(lot_no) AS len, DATALENGTH(lot_no) AS bytes, COUNT(*) OVER() AS 总数
FROM kucun_bak_20261018 WHERE lot_no LIKE 'PC0000%';
PRINT '=== 各 lot 长度分布 ===';
SELECT LEN(lot_no) AS lot_len, COUNT(*) n FROM kucun_bak_20261018 GROUP BY LEN(lot_no) ORDER BY lot_len;
PRINT '=== 当前库 vs 备份 行数 ===';
SELECT (SELECT COUNT(*) FROM kucun) AS 当前, (SELECT COUNT(*) FROM kucun_bak_20261018) AS 备份;
