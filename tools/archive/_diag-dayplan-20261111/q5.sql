SELECT ISNULL(p.scx,N'(空)') AS 产线, COUNT(*) AS 行数,
       CONVERT(varchar(10),MIN(w.计划开工日期),120) AS 最早工序开工,
       CONVERT(varchar(10),MAX(w.计划完工日期),120) AS 最晚工序完工
FROM plang p JOIN wo_process_line w ON w.工单行id = p.id AND ISNULL(w.asp_cancel,'N')<>'Y'
WHERE ISNULL(p.asp_cancel,'N')<>'Y' AND ISNULL(p.scx,N'')<>N''
GROUP BY p.scx ORDER BY 最晚工序完工 DESC;
SELECT p.id, p.pl_no, ISNULL(p.[当前工序],N'') AS 当前工序,
       CONVERT(varchar(10),p.st_date,120) AS 行开工, CONVERT(varchar(10),p.cp_date,120) AS 行完工,
       (SELECT CONVERT(varchar(10),MAX(w.计划完工日期),120) FROM wo_process_line w
          WHERE w.工单行id=p.id AND ISNULL(w.asp_cancel,'N')<>'Y' AND w.工序=N'组装') AS 组装台账完工
FROM plang p WHERE ISNULL(p.asp_cancel,'N')<>'Y' AND ISNULL(p.scx,N'')=N'装箱1(老厂)'
ORDER BY p.id;
