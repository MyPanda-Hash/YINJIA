SELECT p.id, p.pl_no, p.pl_xc, p.od_no, p.od_xc, p.dm, p.pl_sl, p.xq_sl,
       (SELECT COUNT(*) FROM dbo.wo_process_line w WHERE w.工单行id=p.id) AS 台账
FROM dbo.plang p WHERE p.pl_no IN (N'GD-2026-11-0005', N'GD-2026-11-0006') ORDER BY p.pl_no, p.pl_xc;
GO
SELECT target_form_no, target_line_key, linked_quantity FROM dbo.form_flow_link
WHERE target_form_no IN (N'GD-2026-11-0005', N'GD-2026-11-0006') ORDER BY target_line_key;
GO
