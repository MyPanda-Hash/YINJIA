SET NOCOUNT ON;
-- 完全复刻 QueryService 对 STOCK_BALANCE 的两条 SQL(参数化:OFFSET/FETCH)
DECLARE @t datetime2, @n int;
SET @t=SYSDATETIME();
EXEC sp_executesql N'SELECT COUNT(*) FROM v_stock_balance t WHERE ISNULL(t.asp_cancel,''N'')<>''Y''', N'@n int OUT', @n OUT;
SELECT N'1 COUNT(*) STOCK_BALANCE' AS k, @n AS rows_n, DATEDIFF(ms,@t,SYSDATETIME()) AS ms;
GO
DECLARE @t datetime2;
SET @t=SYSDATETIME();
EXEC sp_executesql N'SELECT t.id AS __id, t.id FROM v_stock_balance t WHERE ISNULL(t.asp_cancel,''N'')<>''Y'' ORDER BY t.id DESC OFFSET @p1 ROWS FETCH NEXT @p2 ROWS ONLY',
                   N'@p1 int, @p2 int', @p1=0, @p2=20;
SELECT N'2 page 20 STOCK_BALANCE' AS k, DATEDIFF(ms,@t,SYSDATETIME()) AS ms;
GO
DECLARE @t datetime2;
SET @t=SYSDATETIME();
EXEC sp_executesql N'SELECT t.id AS __id, t.id FROM v_stock_ledger t WHERE ISNULL(t.asp_cancel,''N'')<>''Y'' ORDER BY t.id ASC OFFSET @p1 ROWS FETCH NEXT @p2 ROWS ONLY',
                   N'@p1 int, @p2 int', @p1=0, @p2=20;
SELECT N'3 page 20 STOCK_LEDGER' AS k, DATEDIFF(ms,@t,SYSDATETIME()) AS ms;
GO
DECLARE @t datetime2;
SET @t=SYSDATETIME();
EXEC sp_executesql N'SELECT t.id AS __id, t.id FROM v_stock_summary t WHERE ISNULL(t.asp_cancel,''N'')<>''Y'' ORDER BY t.id DESC OFFSET @p1 ROWS FETCH NEXT @p2 ROWS ONLY',
                   N'@p1 int, @p2 int', @p1=0, @p2=20;
SELECT N'4 page 20 STOCK_SUMMARY' AS k, DATEDIFF(ms,@t,SYSDATETIME()) AS ms;
GO
DECLARE @t datetime2;
SET @t=SYSDATETIME();
EXEC sp_executesql N'SELECT t.id AS __id, t.id FROM kucun t WHERE ISNULL(t.asp_cancel,''N'')<>''Y'' ORDER BY t.id DESC OFFSET @p1 ROWS FETCH NEXT @p2 ROWS ONLY',
                   N'@p1 int, @p2 int', @p1=0, @p2=20;
SELECT N'5 page 20 STOCK_STATUS(kucun)' AS k, DATEDIFF(ms,@t,SYSDATETIME()) AS ms;
GO
