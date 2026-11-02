SET NOCOUNT ON;
-- 删掉未审批的测试单 LL-2026-11-0007(无流水,可安全删),让工单能重新生单
DELETE l FROM bl_material_out l WHERE l.单据编号 = N'LL-2026-11-0007';
DELETE s FROM yj_doc_status s WHERE s.doc_no = N'LL-2026-11-0007';
DELETE h FROM bd_material_out h WHERE h.单据编号 = N'LL-2026-11-0007';
DELETE x FROM wo_pick_line x WHERE x.单头id IN (SELECT id FROM wo_pick_doc WHERE 领料单号 = N'LL-2026-11-0007');
DELETE d FROM wo_pick_doc d WHERE d.领料单号 = N'LL-2026-11-0007';
SELECT '清理完成' k, (SELECT COUNT(*) FROM wo_pick_doc WHERE 领料单号=N'LL-2026-11-0007') 残留;
