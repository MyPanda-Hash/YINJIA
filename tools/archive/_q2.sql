SET NOCOUNT ON;
SELECT t.name + '|' + c.name FROM sys.tables t JOIN sys.columns c ON c.object_id=t.object_id
WHERE t.name IN ('dm_kh','dm_gf','bs_inv','bs_emp','bs_dept','bs_wh','bs_uom','bs_settle_type','bs_customer_group','bs_supplier_group','bs_material_group','bs_currency')
ORDER BY t.name, c.column_id;
