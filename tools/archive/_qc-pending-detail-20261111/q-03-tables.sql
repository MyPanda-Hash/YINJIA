SET NOCOUNT ON;
PRINT N'=== A. sl_recv_detail ===';
SELECT c.column_id, c.name, t.name AS type, c.max_length
FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID(N'dbo.sl_recv_detail') ORDER BY c.column_id;
PRINT N'=== B. sl_recv 头 ===';
SELECT c.column_id, c.name, t.name AS type, c.max_length
FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID(N'dbo.sl_recv') ORDER BY c.column_id;
PRINT N'=== C. bl_purchase_in ===';
SELECT c.column_id, c.name, t.name AS type, c.max_length
FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID(N'dbo.bl_purchase_in') ORDER BY c.column_id;
PRINT N'=== D. bd_purchase_in 业务列(非备用) ===';
SELECT c.column_id, c.name, t.name AS type, c.max_length
FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID(N'dbo.bd_purchase_in') AND c.name NOT LIKE N'备用%' ORDER BY c.column_id;
PRINT N'=== E. 面板模式分布 ===';
SELECT mode, COUNT(*) AS n FROM yj_panel GROUP BY mode;
PRINT N'=== F. 一个 flat 面板样例(采购入库单) ===';
SELECT panel_code, panel_name, mode, page_size, config FROM yj_panel WHERE panel_code = N'PURCHASE_IN';
