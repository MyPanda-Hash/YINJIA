SET NOCOUNT ON;
PRINT '=== inh 中 rid 指向"当前明细表不存在的行"的记录(孤儿) ===';
SELECT COUNT(*) 孤儿行数, CAST(SUM(数量) AS decimal(18,4)) 孤儿合计
FROM inh i WHERE ISNULL(i.asp_cancel,'N')<>'Y' AND i.rid IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM bl_purchase_in l WHERE l.id=i.rid);
PRINT '=== outh 同款 ===';
SELECT COUNT(*) 孤儿行数, CAST(SUM(数量) AS decimal(18,4)) 孤儿合计
FROM outh o WHERE ISNULL(o.asp_cancel,'N')<>'Y' AND o.rid IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM bl_sale_out l WHERE l.id=o.rid);
