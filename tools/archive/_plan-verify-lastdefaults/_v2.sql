SET NOCOUNT ON;
-- D) 条7首道:按物料取最近一次排产线(plang_pc 排产台账,430 行全填;经 plang_id 取工单号)
SELECT TOP 8 t.dm, t.上次首道线, t.上次工单号, t.上次日期
FROM (SELECT pc.dm, pc.scx AS 上次首道线, p.pl_no AS 上次工单号,
             CONVERT(varchar(10), pc.pl_date,120) AS 上次日期,
             ROW_NUMBER() OVER (PARTITION BY pc.dm ORDER BY pc.pl_date DESC, pc.id DESC) rn
      FROM dbo.plang_pc pc LEFT JOIN dbo.plang p ON p.id = pc.plang_id
      WHERE ISNULL(pc.asp_cancel,'N')<>'Y' AND ISNULL(pc.scx,N'')<>N'') t
WHERE t.rn=1 ORDER BY t.上次日期 DESC;
-- D2) 两源覆盖对比:plang_pc 有排产历史的物料数 vs wo_process_line 在册台账覆盖的物料数
SELECT (SELECT COUNT(DISTINCT dm) FROM dbo.plang_pc WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(scx,N'')<>N'') AS 排产台账物料数,
       (SELECT COUNT(DISTINCT p.dm) FROM dbo.wo_process_line wl JOIN dbo.plang p ON p.id=wl.工单行id
         WHERE ISNULL(wl.asp_cancel,'N')<>'Y' AND COALESCE(NULLIF(wl.实际生产线,N''), wl.计划生产线, N'')<>N'') AS 台账物料数;
-- E) 脏线名佐证:plang_pc.scx 里不在 bs_prod_line 档案的值
SELECT pc.scx, COUNT(*) AS 行数 FROM dbo.plang_pc pc
WHERE ISNULL(pc.asp_cancel,'N')<>'Y' AND ISNULL(pc.scx,N'')<>N''
  AND NOT EXISTS (SELECT 1 FROM dbo.bs_prod_line bl WHERE bl.生产线 = pc.scx AND ISNULL(bl.asp_cancel,'N')<>'Y')
GROUP BY pc.scx ORDER BY 行数 DESC;
-- F) 条39样例里的非标路线现在审没审(预填脏路线的实景)
SELECT doc_no, ISNULL(shr,N'') AS shr, ISNULL(canceled,N'') AS canceled, ISNULL(stopped,N'') AS stopped
FROM dbo.yj_doc_status WHERE panel_code='ROUTE' AND doc_no IN (N'GY-2026-10-0001', N'GY-CB-STD');
