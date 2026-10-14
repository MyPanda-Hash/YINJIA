SET NOCOUNT ON;
PRINT '=== A. 所有含 panel_code 列的 yj_ 表 ===';
SELECT t.name AS tbl, c.name AS col FROM sys.tables t
JOIN sys.columns c ON c.object_id = t.object_id
WHERE c.name LIKE '%panel%' ORDER BY t.name;

PRINT '=== B. 各元数据表里对这两码的登记 ===';
SELECT 'yj_doc_status' AS tbl, COUNT(*) n FROM yj_doc_status WHERE panel_code IN ('MANU_ORDER_DETAIL','MANU_ORDER_STATS');
