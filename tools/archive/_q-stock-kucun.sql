SET NOCOUNT ON;
PRINT '--- kucun 结构与行数 ---';
SELECT c.column_id, c.name, TYPE_NAME(c.system_type_id) AS typ FROM sys.columns c WHERE c.object_id = OBJECT_ID('dbo.kucun') ORDER BY c.column_id;
SELECT COUNT(*) AS kucun行数 FROM kucun;
PRINT '--- kucun 样例 ---';
SELECT TOP 3 * FROM kucun;
PRINT '--- STOCK_STATUS 面板字段(前 15) ---';
SELECT seq, col_name, label, data_type, place, hidden FROM yj_field WHERE panel_code='STOCK_STATUS' ORDER BY seq;
