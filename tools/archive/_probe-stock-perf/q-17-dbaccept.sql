SET NOCOUNT ON;
-- 验收口径 §四.1:正则 COUNT(*) < 1000 ms(不带任何 hint,看缓存的真实计划)
DECLARE @t datetime2, @n int;
SET @t=SYSDATETIME(); SELECT @n=COUNT(*) FROM v_stock_balance;
SELECT N'v_stock_balance COUNT(*)' AS k, @n AS rows_n, DATEDIFF(ms,@t,SYSDATETIME()) AS ms;
GO
DECLARE @t datetime2, @n int;
SET @t=SYSDATETIME(); SELECT @n=COUNT(*) FROM v_stock_movement;
SELECT N'v_stock_movement COUNT(*)' AS k, @n AS rows_n, DATEDIFF(ms,@t,SYSDATETIME()) AS ms;
GO
DECLARE @t datetime2, @n int;
SET @t=SYSDATETIME(); SELECT @n=COUNT(*) FROM v_stock_ledger;
SELECT N'v_stock_ledger COUNT(*)' AS k, @n AS rows_n, DATEDIFF(ms,@t,SYSDATETIME()) AS ms;
GO
DECLARE @t datetime2, @n int;
SET @t=SYSDATETIME(); SELECT @n=COUNT(*) FROM v_stock_summary;
SELECT N'v_stock_summary COUNT(*)' AS k, @n AS rows_n, DATEDIFF(ms,@t,SYSDATETIME()) AS ms;
GO
DECLARE @t datetime2, @n int;
SET @t=SYSDATETIME(); SELECT @n=COUNT(*) FROM kucun;
SELECT N'kucun COUNT(*)' AS k, @n AS rows_n, DATEDIFF(ms,@t,SYSDATETIME()) AS ms;
GO
SELECT N'口径自证' AS k, COUNT(*) AS rows_n, SUM(结存金额) AS total FROM v_stock_balance;
GO
