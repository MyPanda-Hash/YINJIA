SET NOCOUNT ON;
SELECT l.单据编号, l.存货编码, LEFT(l.存货名称,12) AS 名称, l.仓库, l.仓库编码, l.实收数量 FROM bl_purchase_in l WHERE l.单据编号 = 'PI-2026-09-0003';
