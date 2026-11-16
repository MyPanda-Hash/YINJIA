SELECT 生产线, ISNULL(生产车间,N'') AS 生产车间, ISNULL(日产能,0) AS 日产能, ISNULL(停用,0) AS 停用
FROM bs_prod_line WHERE 生产线 IN (N'装箱1(老厂)', N'2号车间', N'切炭2(自动)');
-- 装箱1(老厂) 这条线上、未完工未结案的行数(工单排产页 未完工页签 + 日排产取数范围)
SELECT COUNT(*) AS 该线未结案未完工行数
FROM plang p WHERE ISNULL(p.asp_cancel,'N')<>'Y' AND ISNULL(p.scx,N'')=N'装箱1(老厂)'
  AND ISNULL(p.ja,'N')<>'Y'
  AND ISNULL(p.pl_sl,0) > ISNULL(p.rk_sl,0);
-- 该线「组装」工序台账最晚完工(= 表头右端)
SELECT CONVERT(varchar(10),MAX(w.计划完工日期),120) AS 组装台账最晚完工,
       CONVERT(varchar(10),MIN(w.计划开工日期),120) AS 组装台账最早开工
FROM plang p JOIN wo_process_line w ON w.工单行id=p.id AND ISNULL(w.asp_cancel,'N')<>'Y' AND w.工序=N'组装'
WHERE ISNULL(p.asp_cancel,'N')<>'Y' AND ISNULL(p.scx,N'')=N'装箱1(老厂)';
