SET NOCOUNT ON;
-- 面单据状态
SELECT N'采购入库' AS 面板, 单据编号, 单据状态, 单据状态2, ISNULL(asp_cancel,'N') AS 已取消 FROM bd_purchase_in;
SELECT N'销售出库' AS 面板, 单据编号, 单据状态, 单据状态2, ISNULL(asp_cancel,'N') AS 已取消 FROM bd_sale_out;
-- yj_doc_status 里的状态(单据状态机)
SELECT N'采购入库' AS 面板, 单据编号, saved, modify FROM yj_doc_status WHERE 单据编号 IN (SELECT 单据编号 FROM bd_purchase_in);
SELECT N'销售出库' AS 面板, 单据编号, saved, modify FROM yj_doc_status WHERE 单据编号 IN (SELECT 单据编号 FROM bd_sale_out);
