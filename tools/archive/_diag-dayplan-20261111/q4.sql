SELECT w.工单行id, w.工序, w.工序序, CONVERT(varchar(10),w.计划开工日期,120) AS 开工,
       CONVERT(varchar(10),w.计划完工日期,120) AS 完工, ISNULL(w.状态,N'') AS 状态,
       ISNULL(w.计划生产线,N'') AS 计划线, CONVERT(varchar(19),w.asp_time1,120) AS 录入时间, ISNULL(w.asp_user1,N'') AS 录入人
FROM wo_process_line w
WHERE w.工单行id IN (2173,2176,2177,2180) AND ISNULL(w.asp_cancel,'N')<>'Y'
ORDER BY w.工单行id, ISNULL(w.工序序,999);
SELECT id, pl_no, pl_xc, ISNULL(scx,N'') AS 产线, CONVERT(varchar(10),st_date,120) AS 开工,
       CONVERT(varchar(10),cp_date,120) AS 完工, ISNULL([当前工序],N'') AS 当前工序, ISNULL(ja,N'') AS 结案,
       CONVERT(varchar(19),asp_time1,120) AS 建单时间
FROM plang WHERE id IN (2173,2176,2177,2180);
