SET NOCOUNT ON;
-- 清掉这次测试产生的两张对不上的单,让工单可重新生单
DELETE l FROM bl_material_out l WHERE l.单据编号 IN (N'LL-2026-11-0004', N'LL-2026-11-0005');
DELETE s FROM yj_doc_status s WHERE s.doc_no IN (N'LL-2026-11-0004', N'LL-2026-11-0005');
DELETE h FROM bd_material_out h WHERE h.单据编号 IN (N'LL-2026-11-0004', N'LL-2026-11-0005');
DELETE x FROM wo_pick_line x WHERE x.单头id IN (SELECT id FROM wo_pick_doc WHERE 领料单号 = N'LL-2026-11-0004');
DELETE d FROM wo_pick_doc d WHERE d.领料单号 = N'LL-2026-11-0004';
SELECT '清理完成' k, (SELECT COUNT(*) FROM wo_pick_doc WHERE 领料单号 IN (N'LL-2026-11-0004',N'LL-2026-11-0005')) 残留;
