SELECT COUNT(*) AS 总行数,
       SUM(CASE WHEN cp_date>='2026-11-20' THEN 1 ELSE 0 END) AS 完工晚于1119,
       SUM(CASE WHEN cp_date>='2027-01-01' THEN 1 ELSE 0 END) AS 完工在2027,
       CONVERT(varchar(10),MAX(cp_date),120) AS 最晚完工
FROM plang WHERE ISNULL(asp_cancel,'N')<>'Y';
SELECT TOP 40 id, pl_no, pl_xc, ISNULL(scx,N'') AS 产线, CONVERT(varchar(10),st_date,120) AS 开工,
       CONVERT(varchar(10),cp_date,120) AS 完工, ISNULL(ja,N'') AS 结案, ISNULL([当前工序],N'') AS 当前工序
FROM plang WHERE ISNULL(asp_cancel,'N')<>'Y' AND cp_date>='2026-12-01'
ORDER BY cp_date DESC;
