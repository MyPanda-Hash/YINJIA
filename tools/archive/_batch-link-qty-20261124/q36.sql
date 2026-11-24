SET NOCOUNT ON;
SELECT d.id, d.物料编码, d.数量 AS 单据数量, f.linked_quantity AS 占用数量,
       ISNULL(d.数量,0) - ISNULL(f.linked_quantity,0) AS 差额
  FROM form_flow_link f
  JOIN sl_recv_detail d ON d.id = TRY_CAST(RIGHT(f.target_line_key, CHARINDEX('#', REVERSE(f.target_line_key)) - 1) AS int)
 WHERE f.target_panel_code='QC_RECV' AND f.link_status='ACTIVE' AND f.target_form_no='SL-2026-11-0002'
 ORDER BY d.id;
SELECT id, batch_no, batch_qty FROM yj_doc_batch WHERE id=321;
