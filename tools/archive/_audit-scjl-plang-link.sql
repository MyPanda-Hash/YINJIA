SET NOCOUNT ON;
SELECT DB_NAME() AS db_name;
-- Active plang rows and active pc mirrors by parent row.
SELECT COUNT(*) AS active_plang,
 SUM(CASE WHEN ISNULL(p.scx,N'')<>N'' THEN 1 ELSE 0 END) AS scheduled_plang,
 COUNT(pc.id) AS active_pc_links,
 SUM(CASE WHEN ISNULL(p.scx,N'')<>N'' AND pc.id IS NULL THEN 1 ELSE 0 END) AS scheduled_without_pc
FROM plang p LEFT JOIN plang_pc pc ON pc.plang_id=p.id AND ISNULL(pc.asp_cancel,'N')<>'Y'
WHERE ISNULL(p.asp_cancel,'N')<>'Y';
-- Duplicate active pc rows per plang and mirror conflicts.
SELECT plang_id,COUNT(*) AS pc_rows,MIN(pl_sl) AS min_qty,MAX(pl_sl) AS max_qty,MIN(scx) AS min_line,MAX(scx) AS max_line
FROM plang_pc WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY plang_id
HAVING COUNT(*)>1 OR MIN(pl_sl)<>MAX(pl_sl) OR MIN(scx)<>MAX(scx);
-- Report anchor integrity.
SELECT COUNT(*) AS active_scjl,
 SUM(CASE WHEN ISNULL(s.gd_id,0)>0 AND pc.id IS NULL THEN 1 ELSE 0 END) AS dangling_gd_id,
 SUM(CASE WHEN ISNULL(s.gd_id,0)>0 AND pc.id IS NOT NULL AND p.id IS NULL THEN 1 ELSE 0 END) AS pc_without_plang,
 SUM(CASE WHEN s.[工单行号] IS NOT NULL AND p.id IS NOT NULL AND s.[工单行号]<>p.pl_xc THEN 1 ELSE 0 END) AS row_no_conflict,
 SUM(CASE WHEN ISNULL(s.gd_id,0)=0 AND ISNULL(s.gldh,N'')<>N'' THEN 1 ELSE 0 END) AS unanchored_reports
FROM scjl s LEFT JOIN plang_pc pc ON pc.id=s.gd_id LEFT JOIN plang p ON p.id=pc.plang_id
WHERE ISNULL(s.asp_cancel,'N')<>'Y';
-- Unanchored report batch matches that are ambiguous within a work order.
SELECT s.gldh,s.[批次号],COUNT(DISTINCT p.id) AS candidate_rows,COUNT(*) AS report_rows
FROM scjl s JOIN plang p ON p.pl_no=s.gldh AND ISNULL(p.asp_cancel,'N')<>'Y'
 AND ISNULL(s.gd_id,0)=0 AND ISNULL(s.[批次号],N'')<>N'' AND p.[批次号]=s.[批次号]
WHERE ISNULL(s.asp_cancel,'N')<>'Y' GROUP BY s.gldh,s.[批次号] HAVING COUNT(DISTINCT p.id)<>1;
-- Same work-order line number with multiple batches/rows.
SELECT pl_no,pl_xc,COUNT(*) AS rows_count,COUNT(DISTINCT ISNULL([批次号],N'')) AS batches
FROM plang WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY pl_no,pl_xc HAVING COUNT(*)>1;
-- All report work/row/anchor examples.
SELECT TOP 100 s.id,s.[报工单号],s.gldh,s.[工单行号],s.[批次号],s.gd_id,s.gxdm,s.sl,s.wgzt,pc.plang_id,p.pl_xc,p.[批次号] AS parent_batch,pc.scx
FROM scjl s LEFT JOIN plang_pc pc ON pc.id=s.gd_id LEFT JOIN plang p ON p.id=pc.plang_id
WHERE ISNULL(s.asp_cancel,'N')<>'Y' ORDER BY s.id DESC;
-- Process-line records vs parent rows and planned lines.
SELECT COUNT(*) AS process_rows,
 SUM(CASE WHEN p.id IS NULL THEN 1 ELSE 0 END) AS process_without_plang,
 SUM(CASE WHEN w.计划生产线<>p.scx AND ISNULL(w.实际生产线,N'')<>p.scx THEN 1 ELSE 0 END) AS process_line_conflicts
FROM wo_process_line w LEFT JOIN plang p ON p.id=w.工单行id AND ISNULL(p.asp_cancel,'N')<>'Y'
WHERE ISNULL(w.asp_cancel,'N')<>'Y';
