SET NOCOUNT ON;
SELECT h.单据编号, h.仓库, h.单据状态, (SELECT COUNT(*) FROM bl_purchase_in l WHERE l.单据编号=h.单据编号) AS 行数 FROM bd_purchase_in h ORDER BY h.id;
SELECT 单据编号, LEFT(存货名称,12) AS 存货, 实收数量, 仓库 FROM bl_purchase_in ORDER BY 单据编号;
