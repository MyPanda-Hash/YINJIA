SET NOCOUNT ON;
PRINT '=== 采购入库单:明细行数 vs inh 行数(应相等) ===';
SELECT TOP 6 h.单据编号,
  (SELECT COUNT(*) FROM bl_purchase_in l WHERE l.单据编号=h.单据编号 AND ISNULL(l.asp_cancel,'N')<>'Y') 明细行,
  (SELECT COUNT(*) FROM inh i WHERE i.单据编号=h.单据编号 AND ISNULL(i.asp_cancel,'N')<>'Y') inh行
FROM bd_purchase_in h
WHERE ISNULL(h.asp_cancel,'N')<>'Y'
  AND EXISTS (SELECT 1 FROM inh i WHERE i.单据编号=h.单据编号)
  AND (SELECT COUNT(*) FROM bl_purchase_in l WHERE l.单据编号=h.单据编号 AND ISNULL(l.asp_cancel,'N')<>'Y')
    <> (SELECT COUNT(*) FROM inh i WHERE i.单据编号=h.单据编号 AND ISNULL(i.asp_cancel,'N')<>'Y')
ORDER BY h.单据日期 DESC;
PRINT '=== 不一致的单据总数 ===';
SELECT COUNT(*) 行数不等的单据数 FROM bd_purchase_in h
WHERE ISNULL(h.asp_cancel,'N')<>'Y'
  AND EXISTS (SELECT 1 FROM inh i WHERE i.单据编号=h.单据编号)
  AND (SELECT COUNT(*) FROM bl_purchase_in l WHERE l.单据编号=h.单据编号 AND ISNULL(l.asp_cancel,'N')<>'Y')
    <> (SELECT COUNT(*) FROM inh i WHERE i.单据编号=h.单据编号 AND ISNULL(i.asp_cancel,'N')<>'Y');
