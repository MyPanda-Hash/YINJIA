SET NOCOUNT ON;
SELECT 'A.定义' AS k, v.name, CONVERT(nvarchar(max), m.definition) AS def FROM sys.views v JOIN sys.sql_modules m ON m.object_id = v.object_id WHERE v.name IN ('v_stock_balance','v_stock_ledger');
SELECT 'B.用视图的面板' AS k, panel_code, panel_name, mode, line_table, head_table FROM yj_panel WHERE line_table IN ('v_stock_balance','v_stock_ledger','v_stock_movement') OR head_table IN ('v_stock_balance','v_stock_ledger');
SELECT 'C.kucun 行数与列数' AS k, (SELECT COUNT(*) FROM kucun) AS rows_n, (SELECT COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID('kucun')) AS cols_n;
GO
