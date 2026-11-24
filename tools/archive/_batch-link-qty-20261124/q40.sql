SET NOCOUNT ON;
SELECT d.数量 AS 单据数量, f.linked_quantity AS 占用数量, (SELECT batch_qty FROM yj_doc_batch WHERE id=321) AS 批次台账
  FROM form_flow_link f
  JOIN sl_recv_detail d ON d.id = TRY_CAST(RIGHT(f.target_line_key, CHARINDEX('#', REVERSE(f.target_line_key)) - 1) AS int)
 WHERE f.id=1674;
