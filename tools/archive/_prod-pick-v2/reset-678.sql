SET NOCOUNT ON;
-- 只清 GD-DEMO-06/07/08 这三张还没领过东西的单,让它们回到"未开单"状态
DECLARE @keep TABLE (no varchar(20));
INSERT INTO @keep VALUES ('GD-DEMO-06'),('GD-DEMO-07'),('GD-DEMO-08');

DELETE FROM dbo.wo_pick_return WHERE 领料单号 IN (
  SELECT 领料单号 FROM wo_pick_doc WHERE 工单号 IN (SELECT no FROM @keep));
DELETE FROM bl_material_out WHERE 单据编号 IN (
  SELECT 单据编号 FROM bd_material_out WHERE 加工单号 IN (SELECT no FROM @keep));
DELETE FROM bd_material_out WHERE 加工单号 IN (SELECT no FROM @keep);
DELETE FROM yj_doc_status WHERE doc_no IN (
  SELECT 单据编号 FROM bd_other_in WHERE 备注 LIKE '%GD-DEMO-06%' OR 备注 LIKE '%GD-DEMO-07%' OR 备注 LIKE '%GD-DEMO-08%');
DELETE FROM dbo.wo_pick_doc WHERE 工单号 IN (SELECT no FROM @keep);

SELECT '已重置为未开单' k, COUNT(*) n FROM wo_pick_doc WHERE 工单号 IN (SELECT no FROM @keep);
