SET NOCOUNT ON;
DELETE FROM bl_purchase_in WHERE 单据编号 IN (SELECT 单据编号 FROM bd_purchase_in WHERE 外部数据ID IS NOT NULL AND 单据编号 <> 'CGRK-20260915-03213');
DELETE FROM bl_sale_out WHERE 单据编号 IN (SELECT 单据编号 FROM bd_sale_out WHERE 外部数据ID IS NOT NULL AND 单据编号 <> 'XSCK-20270901-00001');
DELETE FROM bd_purchase_in WHERE 外部数据ID IS NOT NULL AND 单据编号 <> 'CGRK-20260915-03213';
DELETE FROM bd_sale_out WHERE 外部数据ID IS NOT NULL AND 单据编号 <> 'XSCK-20270901-00001';
SELECT 'pur_head' AS t, COUNT(*) FROM bd_purchase_in UNION ALL SELECT 'pur_line', COUNT(*) FROM bl_purchase_in UNION ALL SELECT 'so_head', COUNT(*) FROM bd_sale_out UNION ALL SELECT 'so_line', COUNT(*) FROM bl_sale_out;
