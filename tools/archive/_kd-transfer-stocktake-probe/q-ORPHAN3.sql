SET NOCOUNT ON;
PRINT '=== outh 孤儿(补全对照 bl_material_out/bl_other_out/bl_stocktake) ===';
SELECT src, COUNT(*) 行数, CAST(SUM(数量) AS decimal(18,4)) 合计 FROM outh o
WHERE ISNULL(o.asp_cancel,'N')<>'Y' AND o.rid IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM bl_sale_out l WHERE l.id=o.rid)
  AND NOT EXISTS (SELECT 1 FROM bl_material_out l WHERE l.id=o.rid)
  AND NOT EXISTS (SELECT 1 FROM bl_other_out l WHERE l.id=o.rid)
  AND NOT EXISTS (SELECT 1 FROM bl_stocktake l WHERE l.id=o.rid)
  AND NOT EXISTS (SELECT 1 FROM bl_transfer l WHERE l.id=o.rid)
GROUP BY src ORDER BY src;
PRINT '=== src=6 是否有 rid 为空的 ===';
SELECT COUNT(*) 总数, SUM(CASE WHEN rid IS NULL THEN 1 ELSE 0 END) rid为空 FROM outh WHERE src=6 AND ISNULL(asp_cancel,'N')<>'Y';
