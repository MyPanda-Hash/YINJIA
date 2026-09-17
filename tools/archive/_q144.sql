SET NOCOUNT ON;
SELECT t.name, c.name AS col, ty.name AS tp FROM sys.tables t JOIN sys.columns c ON c.object_id=t.object_id JOIN sys.types ty ON ty.user_type_id=c.user_type_id
WHERE t.name IN ('bd_purchase_in','bd_sale_out','bd_finish_in') AND c.name=N'单据日期';
SELECT compatibility_level FROM sys.databases WHERE name='HSDZ_MES';
SELECT COUNT(*) AS ledger_ok FROM v_stock_ledger;
