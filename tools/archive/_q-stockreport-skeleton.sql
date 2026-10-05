SET NOCOUNT ON;
SELECT panel_code, panel_name, category, mode, ISNULL(head_table,'') AS head_table, ISNULL(line_table,'') AS line_table
FROM yj_panel WHERE panel_code LIKE 'STOCK%' OR panel_name LIKE N'%库存%' OR panel_name LIKE N'%收发存%' OR panel_name LIKE N'%台账%'
ORDER BY panel_code;
GO
SELECT o.name, o.type_desc, LEN(m.definition) AS 定义字符数 FROM sys.objects o LEFT JOIN sys.sql_modules m ON m.object_id=o.object_id
WHERE o.name IN ('v_stock_movement','v_stock_ledger','v_stock_balance','v_stock_status','inv_cost_ledger','kucun','v_lot_trace') ORDER BY o.name;
GO
SELECT c.column_id, c.name, TYPE_NAME(c.system_type_id) AS typ FROM sys.columns c WHERE c.object_id=OBJECT_ID('dbo.inv_cost_ledger') ORDER BY c.column_id;
GO
SELECT COUNT(*) AS kucun行数 FROM kucun;
GO
