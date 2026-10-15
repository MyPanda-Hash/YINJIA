SET NOCOUNT ON;
SELECT DB_NAME() AS db_name;
SELECT COUNT(*) AS active_work_rows,
 SUM(CASE WHEN ISNULL(p.scx,N'')<>N'' THEN 1 ELSE 0 END) AS scheduled_work_rows,
 SUM(CASE WHEN ISNULL(p.scx,N'')<>N'' AND pc.id IS NULL THEN 1 ELSE 0 END) AS missing_schedule_mirror,
 SUM(CASE WHEN ISNULL(p.scx,N'')<>N'' AND ISNULL(pc.pl_sl,0)<>ISNULL(p.pl_sl,0) THEN 1 ELSE 0 END) AS quantity_mismatch,
 SUM(CASE WHEN ISNULL(p.scx,N'')<>N'' AND ISNULL(pc.scx,N'')<>ISNULL(p.scx,N'') THEN 1 ELSE 0 END) AS line_mismatch
FROM dbo.plang p LEFT JOIN dbo.plang_pc pc ON pc.plang_id=p.id AND ISNULL(pc.asp_cancel,'N')<>'Y'
WHERE ISNULL(p.asp_cancel,'N')<>'Y';
SELECT p.id,p.pl_no,p.pl_xc,p.[批次号],p.xq_sl,p.pl_sl,p.scx,pc.id AS pc_id,pc.pl_sl AS pc_pl_sl,pc.scx AS pc_scx
FROM dbo.plang p LEFT JOIN dbo.plang_pc pc ON pc.plang_id=p.id AND ISNULL(pc.asp_cancel,'N')<>'Y'
WHERE ISNULL(p.asp_cancel,'N')<>'Y' AND ISNULL(p.scx,N'')<>N''
 AND (pc.id IS NULL OR ISNULL(pc.pl_sl,0)<>ISNULL(p.pl_sl,0) OR ISNULL(pc.scx,N'')<>ISNULL(p.scx,N''));
SELECT pc.scx AS production_line,COUNT(*) AS rows_count,SUM(ISNULL(pc.pl_sl,0)) AS scheduled_qty,
 SUM(CASE WHEN l.生产线 IS NULL THEN 1 ELSE 0 END) AS missing_line_master,
 SUM(CASE WHEN ISNULL(l.停用,0)=1 THEN 1 ELSE 0 END) AS disabled_line_rows
FROM dbo.plang_pc pc LEFT JOIN dbo.bs_prod_line l ON l.生产线=pc.scx AND ISNULL(l.asp_cancel,'N')<>'Y'
WHERE ISNULL(pc.asp_cancel,'N')<>'Y' AND ISNULL(pc.scx,N'')<>N'' GROUP BY pc.scx ORDER BY pc.scx;
SELECT COUNT(*) AS active_reports,
 SUM(CASE WHEN pc.id IS NULL THEN 1 ELSE 0 END) AS reports_without_schedule_anchor,
 SUM(CASE WHEN p.id IS NULL THEN 1 ELSE 0 END) AS reports_without_work_row
FROM dbo.scjl s LEFT JOIN dbo.plang_pc pc ON pc.id=s.gd_id LEFT JOIN dbo.plang p ON p.id=pc.plang_id
WHERE ISNULL(s.asp_cancel,'N')<>'Y';
