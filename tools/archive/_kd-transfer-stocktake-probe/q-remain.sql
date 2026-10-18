SET NOCOUNT ON;
PRINT '=== 剩余 4 张草稿单的明细 + 对应库存 ===';
SELECT h.单据编号, l.存货编码, ISNULL(l.批号,'<NULL>') lot, l.数量, l.调出仓库编码,
  (SELECT ISNULL(SUM(CASE WHEN k.yl>0 THEN k.yl ELSE 0 END),0) FROM kucun k WHERE k.wzdm=l.存货编码 AND k.ckdm=l.调出仓库编码) AS 可用
FROM bd_transfer h JOIN bl_transfer l ON l.单据编号=h.单据编号
WHERE h.单据编号 LIKE 'YCD%' AND ISNULL(l.asp_cancel,'N')<>'Y'
  AND h.单据编号 IN (N'YCD-20260908-00001',N'YCD-20260912-00002',N'YCD-20260923-00001',N'YCD-20261005-00001')
  AND NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code='TRANSFER' AND s.doc_no=h.单据编号 AND s.shr IS NOT NULL)
ORDER BY h.单据编号, l.序号;
