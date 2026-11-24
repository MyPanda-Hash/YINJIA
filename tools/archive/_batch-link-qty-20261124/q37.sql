SET NOCOUNT ON;
SELECT d.id, d.数量, f.linked_quantity FROM form_flow_link f
  JOIN sl_recv_detail d ON d.id = TRY_CAST(RIGHT(f.target_line_key, CHARINDEX('#', REVERSE(f.target_line_key)) - 1) AS int)
 WHERE f.id=1674;
SELECT id, batch_qty FROM yj_doc_batch WHERE id=321;
-- 人为制造一次「幽灵占用」:占用写 9000、单据仍是 8000,用来验证稽核与修数脚本
UPDATE form_flow_link SET linked_quantity=9000 WHERE id=1674;
UPDATE yj_doc_batch SET batch_qty=21900 WHERE id=321;
SELECT '已人为制造漂移' AS note;
