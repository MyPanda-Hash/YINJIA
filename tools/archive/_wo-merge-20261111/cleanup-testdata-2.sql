DECLARE @ids TABLE (id int);
INSERT INTO @ids (id) SELECT id FROM dbo.plang WHERE pl_no IN (N'GD-2026-11-0005', N'GD-2026-11-0006');
DELETE FROM dbo.wo_process_line WHERE 工单行id IN (SELECT id FROM @ids);
DELETE FROM dbo.form_flow_link WHERE target_form_no IN (N'GD-2026-11-0005', N'GD-2026-11-0006');
DELETE FROM dbo.plang WHERE id IN (SELECT id FROM @ids);
SELECT COUNT(*) AS 残留 FROM dbo.plang WHERE pl_no IN (N'GD-2026-11-0005', N'GD-2026-11-0006');
SELECT COUNT(*) AS 该订单待结转 FROM bd_so_order o JOIN bl_so_order l ON l.[单据编号]=o.[单据编号] AND ISNULL(l.asp_cancel,'N')<>'Y'
 OUTER APPLY (SELECT SUM(ISNULL(linked_quantity,0)) AS linked FROM form_flow_link f
   WHERE f.source_panel_code='SO_ORDER' AND f.source_line_key=o.[单据编号]+N'#'+CAST(l.[id] AS nvarchar(20))
     AND f.target_panel_code IN ('MANU_ORDER','PLANG') AND f.link_status='ACTIVE') m
WHERE o.[单据编号]=N'ZL-20261016-01' AND ISNULL(l.[数量],0)-ISNULL(m.linked,0) > 0.0001;
GO
