SET NOCOUNT ON;
-- 现有工单/BOM/台账情况
SELECT '工单' k, COUNT(*) n FROM plang WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT 'BOM头', COUNT(*) FROM rd_asm_bom_head
UNION ALL SELECT 'BOM行', COUNT(*) FROM rd_asm_bom_detail
UNION ALL SELECT '台账', COUNT(*) FROM wo_pick_doc
UNION ALL SELECT '退料台账', COUNT(*) FROM wo_pick_return
UNION ALL SELECT '材料出库单', COUNT(*) FROM bd_material_out
UNION ALL SELECT '其他入库单', COUNT(*) FROM bd_other_in;
GO
-- 可用物料(有库存的)
SELECT TOP 15 存货编码, 存货名称, 计量单位, 仓库, 仓库编码, 现存量
  FROM v_stock_pick WHERE 现存量 > 100 AND 仓库 = '恒亿仓' ORDER BY 现存量 DESC;
