SET NOCOUNT ON;
SELECT 库 = DB_NAME(), v_stock_kucun行数 = (SELECT COUNT(*) FROM v_stock_kucun), kucun行数 = (SELECT COUNT(*) FROM kucun);
SELECT TOP 5 * FROM v_stock_kucun;
