SET NOCOUNT ON;
PRINT N'=== source to target active links exact target existence ===';
SELECT f.target_panel_code,COUNT(*) links,
 SUM(CASE WHEN f.target_panel_code='PLANG' AND p.id IS NULL THEN 1 ELSE 0 END) missing_target
FROM form_flow_link f
LEFT JOIN plang p ON f.target_panel_code='PLANG' AND p.pl_no=f.target_form_no
WHERE f.source_panel_code='SO_ORDER' AND f.link_status='ACTIVE' GROUP BY f.target_panel_code;
PRINT N'=== current plang rows without source-order identity ===';
SELECT COUNT(*) no_source_order,
 SUM(CASE WHEN ISNULL(od_no,N'')='' THEN 1 ELSE 0 END) empty_order_no,
 SUM(CASE WHEN ISNULL(od_xc,0)=0 THEN 1 ELSE 0 END) empty_order_line
FROM plang WHERE ISNULL(asp_cancel,'N')<>'Y';
PRINT N'=== valid plang_pc duplicate/missing parent and mirror ===';
SELECT plang_id,COUNT(*) active_pc,MIN(pl_sl) min_pc_qty,MAX(pl_sl) max_pc_qty,MIN(scx) min_line,MAX(scx) max_line
FROM plang_pc WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY plang_id HAVING COUNT(*)<>1 OR MIN(pl_sl)<>MAX(pl_sl) OR MIN(scx)<>MAX(scx);
PRINT N'=== all scjl identity exceptions concise ===';
SELECT s.id,s.[报工单号],s.gldh,s.[工单行号],s.[批次号],s.gd_id,s.gxdm,s.sl,s.wgzt,
 CASE WHEN p.id IS NULL THEN N'无排产行' WHEN s.[工单行号] IS NOT NULL AND s.[工单行号]<>p.pl_xc THEN N'行号冲突' ELSE N'OK' END AS 异常
FROM scjl s LEFT JOIN plang_pc pc ON pc.id=s.gd_id LEFT JOIN plang p ON p.id=pc.plang_id
WHERE ISNULL(s.asp_cancel,'N')<>'Y' AND (p.id IS NULL OR (s.[工单行号] IS NOT NULL AND s.[工单行号]<>p.pl_xc));
PRINT N'=== done report grouped vs plan ===';
SELECT s.gldh,p.pl_xc,p.pl_sl,pc.scx,s.gxdm,SUM(CASE WHEN RTRIM(s.wgzt)=N'Y' THEN ISNULL(s.sl,0) ELSE 0 END) done_qty,
 MAX(CASE WHEN RTRIM(s.wgzt)=N'Y' AND ISNULL(s.post_no,N'')<>N'' THEN 1 ELSE 0 END) has_receipt
FROM scjl s JOIN plang_pc pc ON pc.id=s.gd_id JOIN plang p ON p.id=pc.plang_id
WHERE ISNULL(s.asp_cancel,'N')<>'Y' GROUP BY s.gldh,p.pl_xc,p.pl_sl,pc.scx,s.gxdm ORDER BY s.gldh,p.pl_xc,s.gxdm;
