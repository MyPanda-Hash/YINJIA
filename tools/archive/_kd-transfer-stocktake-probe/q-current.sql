SET NOCOUNT ON;
SELECT (SELECT COUNT(*) FROM kucun) 库存行, (SELECT SUM(yl) FROM kucun) 合计;
SELECT COUNT(*) AS 期初行数 FROM inh WHERE 单据类型=N'期初结存';
SELECT TOP 3 单据编号, 单据日期, COUNT(*) OVER() AS 总数 FROM inh WHERE 单据类型=N'期初结存' ORDER BY id DESC;
PRINT '=== YJ-AJ-016-1 / CK00006 ===';
SELECT ISNULL(lot_no,'<NULL>') lot, yl FROM kucun WHERE wzdm=N'YJ-AJ-016-1' AND ckdm=N'CK00006';
