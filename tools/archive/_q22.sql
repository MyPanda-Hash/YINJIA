SET NOCOUNT ON;
SELECT COUNT(*) AS pur_head FROM bd_purchase_in;
SELECT COUNT(*) AS pur_line FROM bl_purchase_in;
SELECT COUNT(*) AS so_head FROM bd_sale_out;
SELECT COUNT(*) AS so_line FROM bl_sale_out;
-- 查现有数据是否有英文内容
SELECT TOP 3 单据编号, 单据日期, 供应商 FROM bd_purchase_in ORDER BY id DESC;
SELECT TOP 3 单据编号, 单据日期, 客户 FROM bd_sale_out ORDER BY id DESC;
