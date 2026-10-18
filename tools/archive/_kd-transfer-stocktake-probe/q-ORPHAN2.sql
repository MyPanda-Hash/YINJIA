SET NOCOUNT ON;
PRINT '=== inh 孤儿 rid 按 src 分布 ===';
SELECT src, COUNT(*) 行数, CAST(SUM(数量) AS decimal(18,4)) 合计 FROM inh i
WHERE ISNULL(i.asp_cancel,'N')<>'Y' AND i.rid IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM bl_purchase_in l WHERE l.id=i.rid)
  AND NOT EXISTS (SELECT 1 FROM bl_finish_in l WHERE l.id=i.rid)
  AND NOT EXISTS (SELECT 1 FROM bl_other_in l WHERE l.id=i.rid)
GROUP BY src ORDER BY src;
PRINT '=== outh 孤儿 rid 按 src ===';
SELECT src, COUNT(*) 行数, CAST(SUM(数量) AS decimal(18,4)) 合计 FROM outh o
WHERE ISNULL(o.asp_cancel,'N')<>'Y' AND o.rid IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM bl_sale_out l WHERE l.id=o.rid)
GROUP BY src ORDER BY src;
