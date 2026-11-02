SET NOCOUNT ON;
DELETE FROM dbo.wo_pick_doc;
DELETE FROM bl_material_out WHERE 单据编号 IN (SELECT 单据编号 FROM bd_material_out WHERE 加工单号='GD-E2E-0001');
DELETE FROM bd_material_out WHERE 加工单号='GD-E2E-0001';
DELETE FROM yj_doc_status WHERE doc_no IN (SELECT 单据编号 FROM bd_material_out WHERE 加工单号='GD-E2E-0001');
DELETE FROM bl_other_in WHERE 单据编号 LIKE 'OI-2026-10-0002';
DELETE FROM bd_other_in WHERE 单据编号 LIKE 'OI-2026-10-0002';
DELETE FROM yj_doc_status WHERE doc_no LIKE 'OI-2026-10-0002';
SELECT 'reset ok' k;
