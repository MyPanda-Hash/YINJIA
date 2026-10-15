-- q4-view-cols.sql — 库存报表底层表/视图的列 + 字段与列的对齐(用 sys.columns,视图同样适用)
SET NOCOUNT ON;

PRINT '== 1. v_stock_ledger 列 ==';
SELECT c.column_id, c.name FROM sys.columns c WHERE c.object_id = OBJECT_ID('dbo.v_stock_ledger') ORDER BY c.column_id;

PRINT '== 2. v_stock_summary 列 ==';
SELECT c.column_id, c.name FROM sys.columns c WHERE c.object_id = OBJECT_ID('dbo.v_stock_summary') ORDER BY c.column_id;

PRINT '== 3. v_stock_balance 列 ==';
SELECT c.column_id, c.name FROM sys.columns c WHERE c.object_id = OBJECT_ID('dbo.v_stock_balance') ORDER BY c.column_id;

PRINT '== 4. 库存报表面板字段中「底层对象没有这一列」的(会渲染空列 / 或直接报列名无效) ==';
SELECT f.panel_code, f.id, f.col_name, f.label, f.place, f.seq
FROM yj_field f JOIN yj_panel p ON p.panel_code = f.panel_code
WHERE f.panel_code IN ('STOCK_BALANCE','STOCK_LEDGER','STOCK_SUMMARY','STOCK_DETAIL','STOCK_STATUS')
  AND OBJECT_ID(N'dbo.' + p.line_table) IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM sys.columns c WHERE c.object_id = OBJECT_ID(N'dbo.' + p.line_table) AND c.name = f.col_name)
ORDER BY f.panel_code, f.seq, f.id;

PRINT '== 5. STOCK_STATUS(库存状况,休眠面板)字段全量 ==';
SELECT id, col_name, label, data_type, place, seq, ref_panel FROM yj_field WHERE panel_code='STOCK_STATUS' ORDER BY seq, id;
