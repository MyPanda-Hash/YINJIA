SET NOCOUNT ON;
IF OBJECT_ID('tempdb..#r') IS NOT NULL DROP TABLE #r;
CREATE TABLE #r(seq int IDENTITY, k nvarchar(120), rows_n int, ms int);
GO
DECLARE @t datetime2,@n int;
SET @t=SYSDATETIME(); SELECT @n=COUNT(*) FROM v_stock_movement;
INSERT INTO #r(k,rows_n,ms) VALUES (N'1 v_stock_movement',@n,DATEDIFF(ms,@t,SYSDATETIME()));
GO
DECLARE @t datetime2,@n int;
SET @t=SYSDATETIME(); SELECT @n=COUNT(*) FROM inv_cost_ledger;
INSERT INTO #r(k,rows_n,ms) VALUES (N'2 inv_cost_ledger',@n,DATEDIFF(ms,@t,SYSDATETIME()));
GO
DECLARE @t datetime2,@n int;
SET @t=SYSDATETIME();
SELECT @n=COUNT(*) FROM v_stock_movement m LEFT JOIN inv_cost_ledger c ON c.src=m.src AND c.rid=m.rid;
INSERT INTO #r(k,rows_n,ms) VALUES (N'3 movement LEFT JOIN cost',@n,DATEDIFF(ms,@t,SYSDATETIME()));
GO
DECLARE @t datetime2,@n int;
SET @t=SYSDATETIME(); SELECT @n=COUNT(*) FROM v_stock_balance;
INSERT INTO #r(k,rows_n,ms) VALUES (N'4 v_stock_balance COUNT(*)',@n,DATEDIFF(ms,@t,SYSDATETIME()));
GO
SELECT k, rows_n, ms FROM #r ORDER BY seq;
GO
