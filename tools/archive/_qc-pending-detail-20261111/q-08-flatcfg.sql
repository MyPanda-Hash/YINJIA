SET NOCOUNT ON;
SELECT panel_code, N'[' + ISNULL(head_table,'~null~') + N']' AS head_tbl, N'[' + ISNULL(line_table,'~null~') + N']' AS line_tbl,
       mode, category, page_size, N'[' + ISNULL(date_col,'~null~') + N']' AS date_col
FROM yj_panel WHERE panel_code IN (N'PURCHASE_IN_DETAIL', N'FINISH_IN_DETAIL', N'STOCK_BALANCE', N'PU_ORDER_DETAIL', N'QC_CATALOG', N'QC_INSP_REC');
PRINT N'=== 视图是否存在 ===';
SELECT name, type FROM sys.objects WHERE name IN (N'v_purchase_in_detail', N'v_qc_insp_rec_detail', N'v_stock_balance');
