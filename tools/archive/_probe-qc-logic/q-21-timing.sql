-- q-21-timing.sql — 服务端逐项计时(判断是"库级普遍慢"还是"某张表/某个查询卡")
SET NOCOUNT ON;
DECLARE @t datetime2, @n int, @msg nvarchar(200);
SET @t = SYSDATETIME(); SELECT @n = COUNT(*) FROM yj_panel;
PRINT N'yj_panel 行数=' + CAST(@n AS nvarchar(10)) + N' → ' + CAST(DATEDIFF(ms, @t, SYSDATETIME()) AS nvarchar(10)) + N' ms';
SET @t = SYSDATETIME(); SELECT @n = COUNT(*) FROM yj_field;
PRINT N'yj_field 行数=' + CAST(@n AS nvarchar(10)) + N' → ' + CAST(DATEDIFF(ms, @t, SYSDATETIME()) AS nvarchar(10)) + N' ms';
SET @t = SYSDATETIME(); SELECT @n = COUNT(*) FROM qc_catalog_detail;
PRINT N'qc_catalog_detail 行数=' + CAST(@n AS nvarchar(10)) + N' → ' + CAST(DATEDIFF(ms, @t, SYSDATETIME()) AS nvarchar(10)) + N' ms';
SET @t = SYSDATETIME(); SELECT @n = COUNT(*) FROM qc_insp;
PRINT N'qc_insp 行数=' + CAST(@n AS nvarchar(10)) + N' → ' + CAST(DATEDIFF(ms, @t, SYSDATETIME()) AS nvarchar(10)) + N' ms';
SET @t = SYSDATETIME(); SELECT @n = COUNT(*) FROM bs_inv;
PRINT N'bs_inv 行数=' + CAST(@n AS nvarchar(10)) + N' → ' + CAST(DATEDIFF(ms, @t, SYSDATETIME()) AS nvarchar(10)) + N' ms';
SET @t = SYSDATETIME(); SELECT @n = COUNT(*) FROM yj_doc_status;
PRINT N'yj_doc_status 行数=' + CAST(@n AS nvarchar(10)) + N' → ' + CAST(DATEDIFF(ms, @t, SYSDATETIME()) AS nvarchar(10)) + N' ms';
SET @t = SYSDATETIME(); SELECT @n = COUNT(*) FROM kucun;
PRINT N'kucun 行数=' + CAST(@n AS nvarchar(10)) + N' → ' + CAST(DATEDIFF(ms, @t, SYSDATETIME()) AS nvarchar(10)) + N' ms';
SET @t = SYSDATETIME(); SELECT @n = COUNT(*) FROM inv_cost_ledger;
PRINT N'inv_cost_ledger 行数=' + CAST(@n AS nvarchar(10)) + N' → ' + CAST(DATEDIFF(ms, @t, SYSDATETIME()) AS nvarchar(10)) + N' ms';
-- 视图(疑点:库存视图多路 UNION)
SET @t = SYSDATETIME(); SELECT @n = COUNT(*) FROM v_stock_balance;
PRINT N'v_stock_balance 行数=' + CAST(@n AS nvarchar(10)) + N' → ' + CAST(DATEDIFF(ms, @t, SYSDATETIME()) AS nvarchar(10)) + N' ms';
SET @t = SYSDATETIME(); SELECT @n = COUNT(*) FROM v_stock_ledger;
PRINT N'v_stock_ledger 行数=' + CAST(@n AS nvarchar(10)) + N' → ' + CAST(DATEDIFF(ms, @t, SYSDATETIME()) AS nvarchar(10)) + N' ms';
GO
