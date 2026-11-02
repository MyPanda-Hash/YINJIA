SET NOCOUNT ON;
DELETE FROM dbo.wo_pick_return WHERE 领料单号 IN (SELECT 领料单号 FROM wo_pick_doc WHERE 工单号 LIKE 'GD-DEMO-%');
DELETE FROM bl_material_out WHERE 单据编号 IN (SELECT 单据编号 FROM bd_material_out WHERE 加工单号 LIKE 'GD-DEMO-%');
DELETE FROM bd_material_out WHERE 加工单号 LIKE 'GD-DEMO-%';
DELETE FROM yj_doc_status WHERE doc_no IN (SELECT 单据编号 FROM bd_other_in WHERE 备注 LIKE '%GD-DEMO-%');
DELETE FROM bl_other_in WHERE 单据编号 IN (SELECT 单据编号 FROM bd_other_in WHERE 备注 LIKE '%GD-DEMO-%');
DELETE FROM bd_other_in WHERE 备注 LIKE '%GD-DEMO-%';
DELETE FROM dbo.wo_pick_doc WHERE 工单号 LIKE 'GD-DEMO-%';
SELECT '清理完毕,剩余台账行' k, COUNT(*) n FROM wo_pick_doc;
