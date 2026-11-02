SET NOCOUNT ON;
DECLARE @c TABLE (no varchar(20));
INSERT INTO @c SELECT pl_no FROM plang WHERE pl_no LIKE 'GD-STG-C%';

-- 还原被误领的数量(材料出库单还没审核过账,改回 0 即可)
UPDATE bl SET 数量 = 0
  FROM bl_material_out bl JOIN bd_material_out bd ON bd.单据编号 = bl.单据编号
 WHERE bd.加工单号 IN (SELECT no FROM @c);
-- 台账进度归零
UPDATE d SET 已领项数 = 0
  FROM wo_pick_doc d WHERE d.工单号 IN (SELECT no FROM @c);

SELECT 'C组已重置' k, COUNT(*) n FROM wo_pick_doc WHERE 工单号 IN (SELECT no FROM @c) AND 已领项数 = 0;
