-- 行级：当前工序那道的台账区间  vs  全部工序的台账区间（验证 buildDates 只取当前工序）
SELECT p.id, p.pl_no, ISNULL(p.[当前工序],N'') AS 当前工序,
       CONVERT(varchar(10),p.st_date,120) AS 行开工, CONVERT(varchar(10),p.cp_date,120) AS 行完工,
       (SELECT CONVERT(varchar(10),MAX(w.计划完工日期),120) FROM wo_process_line w
          WHERE w.工单行id=p.id AND ISNULL(w.asp_cancel,'N')<>'Y'
            AND w.工序=ISNULL(p.[当前工序],N'')) AS 当前工序台账完工,
       (SELECT CONVERT(varchar(10),MAX(w.计划完工日期),120) FROM wo_process_line w
          WHERE w.工单行id=p.id AND ISNULL(w.asp_cancel,'N')<>'Y') AS 全部工序台账完工
FROM plang p WHERE p.id IN (2173,2176,2177,2180);
-- 当前工序为空的行的兜底(台账里已落实的最大工序序那道)
SELECT w.工单行id, w.工序, ISNULL(w.状态,N'') AS 状态, ISNULL(w.工序序,0) AS 工序序,
       CONVERT(varchar(10),w.计划完工日期,120) AS 完工
FROM wo_process_line w WHERE w.工单行id=2177 AND ISNULL(w.asp_cancel,'N')<>'Y'
ORDER BY ISNULL(w.工序序,999);
