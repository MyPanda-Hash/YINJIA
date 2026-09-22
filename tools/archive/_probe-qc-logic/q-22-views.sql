SET NOCOUNT ON;
DECLARE @t datetime2, @n int;
SET @t = SYSDATETIME(); SELECT @n = COUNT(*) FROM yj_panel;
PRINT N'yj_panel=' + CAST(@n AS nvarchar(10)) + N' 用时 ' + CAST(DATEDIFF(ms, @t, SYSDATETIME()) AS nvarchar(10)) + N' ms';
SET @t = SYSDATETIME(); SELECT @n = COUNT(*) FROM qc_catalog_detail;
PRINT N'qc_catalog_detail=' + CAST(@n AS nvarchar(10)) + N' 用时 ' + CAST(DATEDIFF(ms, @t, SYSDATETIME()) AS nvarchar(10)) + N' ms';
SET @t = SYSDATETIME(); SELECT @n = COUNT(*) FROM bs_inv;
PRINT N'bs_inv=' + CAST(@n AS nvarchar(10)) + N' 用时 ' + CAST(DATEDIFF(ms, @t, SYSDATETIME()) AS nvarchar(10)) + N' ms';
SET @t = SYSDATETIME(); SELECT @n = COUNT(*) FROM inv_cost_ledger;
PRINT N'inv_cost_ledger=' + CAST(@n AS nvarchar(10)) + N' 用时 ' + CAST(DATEDIFF(ms, @t, SYSDATETIME()) AS nvarchar(10)) + N' ms';
SET @t = SYSDATETIME(); SELECT @n = COUNT(*) FROM v_stock_balance;
PRINT N'v_stock_balance=' + CAST(@n AS nvarchar(10)) + N' 用时 ' + CAST(DATEDIFF(ms, @t, SYSDATETIME()) AS nvarchar(10)) + N' ms';
SET @t = SYSDATETIME(); SELECT @n = COUNT(*) FROM v_stock_ledger;
PRINT N'v_stock_ledger=' + CAST(@n AS nvarchar(10)) + N' 用时 ' + CAST(DATEDIFF(ms, @t, SYSDATETIME()) AS nvarchar(10)) + N' ms';
SET @t = SYSDATETIME(); SELECT @n = COUNT(*) FROM v_stock_movement;
PRINT N'v_stock_movement=' + CAST(@n AS nvarchar(10)) + N' 用时 ' + CAST(DATEDIFF(ms, @t, SYSDATETIME()) AS nvarchar(10)) + N' ms';
GO
