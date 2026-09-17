SET NOCOUNT ON;
-- 3张实际采购入库单的供应商编码和行商品编码(推送的关键:这些编码在沙箱里必须存在)
SELECT h.单据编号, h.供应商, h.供应商编码, h.单据状态, ISNULL(h.asp_user1,'') AS push_flag,
  (SELECT COUNT(*) FROM bl_purchase_in l WHERE l.单据编号=h.单据编号) AS 行数
FROM bd_purchase_in h WHERE h.单据编号 LIKE 'CGRK%' ORDER BY h.id;
-- 每行的商品编码和仓库编码
SELECT l.单据编号, l.存货编码, LEFT(l.存货名称,12) AS 存货, l.仓库编码, l.实收数量, l.单价
FROM bl_purchase_in l WHERE l.单据编号 LIKE 'CGRK%' ORDER BY l.单据编号;
