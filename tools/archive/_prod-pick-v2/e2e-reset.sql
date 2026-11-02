SET NOCOUNT ON;
DELETE FROM dbo.wo_pick_doc;
DELETE FROM bl_material_out WHERE 单据编号 IN (SELECT 单据编号 FROM bd_material_out WHERE 加工单号='GD-E2E-0001');
DELETE FROM bd_material_out WHERE 加工单号='GD-E2E-0001';
DELETE FROM bl_other_in WHERE 单据编号 IN (SELECT 单据编号 FROM bd_other_in WHERE 备注 LIKE '%GD-E2E-0001%');
DELETE FROM bd_other_in WHERE 备注 LIKE '%GD-E2E-0001%';
SELECT 'cleaned' k, (SELECT COUNT(*) FROM bd_material_out WHERE 加工单号='GD-E2E-0001') n;
