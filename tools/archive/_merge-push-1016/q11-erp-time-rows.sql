-- q11-erp-time-rows.sql — 看「转ERP时间」文本列里的怪值(§2 报错的那 24 行)
SET NOCOUNT ON;
PRINT '== bd_purchase_in ==';
SELECT TOP 12 单据编号, asp_user1, 单据日期, 转ERP时间, 创建时间 FROM bd_purchase_in
WHERE 转ERP时间 IS NOT NULL AND ISDATE(转ERP时间) = 0 ORDER BY 单据编号;
PRINT '== bd_sale_out ==';
SELECT TOP 12 单据编号, asp_user1, 单据日期, 转ERP时间, 创建时间 FROM bd_sale_out
WHERE 转ERP时间 IS NOT NULL AND ISDATE(转ERP时间) = 0 ORDER BY 单据编号;
PRINT '== bd_material_out ==';
SELECT TOP 12 单据编号, asp_user1, 单据日期, 转ERP时间, 创建时间 FROM bd_material_out
WHERE 转ERP时间 IS NOT NULL AND ISDATE(转ERP时间) = 0 ORDER BY 单据编号;
