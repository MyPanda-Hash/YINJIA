SET NOCOUNT ON;
DELETE FROM wo_pick_return WHERE 领料单号 NOT LIKE 'LL-2026-10-0006';
DELETE FROM bl_material_out WHERE 单据编号 IN (SELECT 单据编号 FROM bd_material_out WHERE 加工单号 NOT LIKE 'GD-E2E-0001');
DELETE FROM bd_material_out WHERE 加工单号 NOT LIKE 'GD-E2E-0001';
DELETE FROM yj_doc_status WHERE doc_no IN (SELECT 单据编号 FROM bd_other_in WHERE 备注 NOT LIKE '%GD-E2E-0001%');
DELETE FROM bl_other_in WHERE 单据编号 IN (SELECT 单据编号 FROM bd_other_in WHERE 备注 NOT LIKE '%GD-E2E-0001%');
DELETE FROM bd_other_in WHERE 备注 NOT LIKE '%GD-E2E-0001%';
DELETE FROM wo_pick_doc WHERE 工单号 <> 'GD-E2E-0001';
SELECT '剩余台账' k, COUNT(*) n FROM wo_pick_doc;
