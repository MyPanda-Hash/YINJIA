SELECT COUNT(*) AS 残留 FROM dbo.plang WHERE pl_no LIKE N'GD-2026-11-000%';
SELECT COUNT(*) AS 占用链残留 FROM dbo.form_flow_link WHERE target_form_no LIKE N'GD-2026-11-000%';
SELECT COUNT(*) AS 待结转行 FROM bd_so_order o JOIN bl_so_order l ON l.[单据编号]=o.[单据编号] AND ISNULL(l.asp_cancel,'N')<>'Y'
 JOIN yj_doc_status s ON s.panel_code='SO_ORDER' AND s.doc_no=o.[单据编号] AND s.shr IS NOT NULL
  AND ISNULL(s.canceled,'N')<>'Y' AND ISNULL(s.stopped,'N')<>'Y' AND ISNULL(s.erp_close_state,'') NOT IN ('H','S')
  AND ISNULL(s.deleting,'N')<>'Y' AND ISNULL(s.modify_state,'') NOT IN ('R','Y') AND ISNULL(s.pending,'N')<>'Y'
 OUTER APPLY (SELECT SUM(ISNULL(linked_quantity,0)) AS linked FROM form_flow_link f
   WHERE f.source_panel_code='SO_ORDER' AND f.source_line_key=o.[单据编号]+N'#'+CAST(l.[id] AS nvarchar(20))
     AND f.target_panel_code IN ('MANU_ORDER','PLANG') AND f.link_status='ACTIVE') m
WHERE ISNULL(o.asp_cancel,'N')<>'Y' AND ISNULL(l.[数量],0)-ISNULL(m.linked,0) > 0.0001
  AND CONVERT(varchar(10), o.[单据日期],120) = '2026-10-16';
GO
