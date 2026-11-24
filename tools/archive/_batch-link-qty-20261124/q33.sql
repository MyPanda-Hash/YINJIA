SET NOCOUNT ON;
SELECT COUNT(*) AS n
 FROM form_flow_link f
 OUTER APPLY (SELECT x.id, x.asp_cancel AS cx FROM sl_recv_detail x
               WHERE x.id = TRY_CAST(RIGHT(f.target_line_key, CHARINDEX('#', REVERSE(f.target_line_key)) - 1) AS int)) d
 WHERE f.target_panel_code = 'QC_RECV' AND f.link_status = 'ACTIVE'
   AND (d.id IS NULL OR d.cx = 'Y');
