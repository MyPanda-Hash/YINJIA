SELECT p.id, p.pl_no, p.pl_xc, ISNULL(p.[批次号],N'') AS batch, ISNULL(p.[工艺路线],N'-') AS route, p.pl_sl, p.rk_sl,
       ISNULL(p.scx,N'') AS scx, ISNULL(p.[当前工序],N'') AS cur, ISNULL(p.[当前工序完工量],0) AS curqty,
       ISNULL(p.[完工状态],N'') AS done, ISNULL(p.ja,N'-') AS ja, CONVERT(varchar(19),p.asp_time2,120) AS t2
FROM dbo.plang p WHERE p.pl_no = 'GD-2026-10-0220' ORDER BY p.pl_xc;

SELECT w.工序, ISNULL(w.工序序,0) AS seq, ISNULL(w.状态,N'') AS st, ISNULL(w.计划生产线,N'') AS planline,
       ISNULL(w.实际生产线,N'') AS realline, ISNULL(w.计划数量,0) AS planqty, w.工单行id,
       CONVERT(varchar(19),w.asp_time2,120) AS t2
FROM dbo.wo_process_line w WHERE w.工单号 = 'GD-2026-10-0220' AND ISNULL(w.asp_cancel,'N')<>'Y'
ORDER BY ISNULL(w.工序序,999), w.id;

SELECT s.id, s.gldh, s.[工单行号], ISNULL(s.[报工单号],N'') AS rep, s.gxdm, s.sl, ISNULL(s.wgzt,'') AS wgzt, s.gd_id,
       ISNULL(s.scx,N'') AS scx, ISNULL(s.[批次号],N'') AS batch, CONVERT(varchar(19),s.sc_date,120) AS d,
       CONVERT(varchar(19),s.asp_time1,120) AS t1
FROM dbo.scjl s WHERE s.gldh='GD-2026-10-0220' AND ISNULL(s.asp_cancel,'N')<>'Y' ORDER BY s.id;

SELECT pc.id AS pc_id, pc.plang_id, ISNULL(pc.[批次号],N'') AS batch, ISNULL(pc.scx,N'') AS scx, pc.pl_sl AS pc_qty
FROM dbo.plang_pc pc JOIN dbo.plang p ON p.id = pc.plang_id WHERE p.pl_no='GD-2026-10-0220';
