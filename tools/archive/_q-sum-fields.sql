SET NOCOUNT ON;
GO
SELECT panel_code, col_name, label, data_type, place FROM yj_field
 WHERE panel_code IN (N'STOCK_SUMMARY', N'STOCK_LEDGER', N'STOCK_BALANCE')
   AND col_name IN (N'批号', N'收入数量', N'发出数量', N'期次', N'存货', N'单据日期', N'结存数量')
 ORDER BY panel_code, seq;
GO
PRINT '== STOCK_SUMMARY 是否有 批号 / 收入数量 列 ==';
SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='v_stock_summary' AND COLUMN_NAME IN (N'批号',N'收入数量',N'发出数量',N'期次');
GO
