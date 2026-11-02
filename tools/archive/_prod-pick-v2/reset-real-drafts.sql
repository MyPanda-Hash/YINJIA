SET NOCOUNT ON;
-- 删掉本轮脚本生成的、还没提交的领料单草稿(数量已填但状态仍是未完成)
DELETE l FROM bl_material_out l
  JOIN bd_material_out h ON h.单据编号=l.单据编号
 WHERE ISNULL(h.加工单号,'') LIKE 'GD-2026-10-%'
   AND NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code='MATERIAL_OUT' AND s.doc_no=h.单据编号 AND ISNULL(s.shr,'')<>'');
DELETE h FROM bd_material_out h
 WHERE ISNULL(h.加工单号,'') LIKE 'GD-2026-10-%'
   AND NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code='MATERIAL_OUT' AND s.doc_no=h.单据编号 AND ISNULL(s.shr,'')<>'');
DELETE FROM wo_pick_doc WHERE 工单号 LIKE 'GD-2026-10-%' AND 状态 <> '已完成';
SELECT '剩余台账' k, COUNT(*) n FROM wo_pick_doc WHERE 工单号 LIKE 'GD-2026-10-%';
