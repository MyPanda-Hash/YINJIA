SET NOCOUNT ON;
SELECT d.id, d.数量, f.linked_quantity, f.link_status FROM form_flow_link f
  JOIN sl_recv_detail d ON d.id = TRY_CAST(RIGHT(f.target_line_key, CHARINDEX('#', REVERSE(f.target_line_key)) - 1) AS int)
 WHERE f.id=1674;
SELECT id, batch_qty FROM yj_doc_batch WHERE id=321;
