SELECT COUNT(*) AS 工序行数,
       SUM(CASE WHEN 计划完工日期>='2026-11-20' THEN 1 ELSE 0 END) AS 晚于1119,
       SUM(CASE WHEN 计划完工日期>='2027-01-01' THEN 1 ELSE 0 END) AS 在2027,
       CONVERT(varchar(10),MAX(计划完工日期),120) AS 最晚完工
FROM wo_process_line WHERE ISNULL(asp_cancel,'N')<>'Y';
SELECT TOP 40 w.工单行id, w.工序, CONVERT(varchar(10),w.计划开工日期,120) AS 开工,
       CONVERT(varchar(10),w.计划完工日期,120) AS 完工, p.pl_no, ISNULL(p.scx,N'') AS 产线,
       CONVERT(varchar(10),p.cp_date,120) AS 行完工, ISNULL(p.asp_cancel,'N') AS 行作废
FROM wo_process_line w LEFT JOIN plang p ON p.id=w.工单行id
WHERE ISNULL(w.asp_cancel,'N')<>'Y' AND w.计划完工日期>='2026-11-20'
ORDER BY w.计划完工日期 DESC;
