SET NOCOUNT ON;
SELECT lb, COUNT(*) AS cnt, MIN(dh) AS min_dh, MAX(dh) AS max_dh, MAX(ny) AS max_ny
FROM s_allno GROUP BY lb ORDER BY lb;
