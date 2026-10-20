SET NOCOUNT ON;
SELECT lb, MAX(CAST(RIGHT(dh,4) AS int)) AS max_pool, COUNT(*) AS n FROM s_allno
WHERE ny='2026-10' GROUP BY lb ORDER BY lb;
SELECT LEFT(单据编号, CHARINDEX('-',单据编号)-1) lb, MAX(CAST(RIGHT(单据编号,4) AS int)) max_db, COUNT(*) n
FROM qc_insp WHERE 单据编号 LIKE '%-2026-10-%' GROUP BY LEFT(单据编号, CHARINDEX('-',单据编号)-1);
