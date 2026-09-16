SET NOCOUNT ON;
-- 采购入库各单的仓库和行数据
SELECT h.单据编号, h.仓库, h.单据状态,
  (SELECT COUNT(*) FROM bl_purchase_in l WHERE l.单据编号=h.单据编号) AS 行数
FROM bd_purchase_in h ORDER BY h.id;
-- CGRK-20260915-03213 的行
SELECT 存货编码, 存货名称, 实收数量, 计量单位, 仓库 FROM bl_purchase_in WHERE 单据编号='CGRK-20260915-03213';
-- 其他单的行
SELECT TOP 5 单据编号, 存货编码, LEFT(存货名称,12) AS 存货, 实收数量, 仓库 FROM bl_purchase_in WHERE 单据编号<>'CGRK-20260915-03213';
