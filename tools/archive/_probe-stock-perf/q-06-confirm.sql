SET NOCOUNT ON;
DECLARE @t datetime2;
SET @t=SYSDATETIME(); SELECT COUNT(*) AS n FROM v_stock_movement;
SELECT N'1 movement (cached plan)' AS k, DATEDIFF(ms,@t,SYSDATETIME()) AS ms;
GO
DECLARE @t datetime2;
SET @t=SYSDATETIME(); SELECT COUNT(*) AS n FROM v_stock_movement;
SELECT N'2 movement (cached plan, 2nd)' AS k, DATEDIFF(ms,@t,SYSDATETIME()) AS ms;
GO
DECLARE @t datetime2;
SET @t=SYSDATETIME(); SELECT COUNT(*) AS n FROM v_stock_balance;
SELECT N'3 balance (cached plan)' AS k, DATEDIFF(ms,@t,SYSDATETIME()) AS ms;
GO
-- 口径基准:结存金额合计(用 RECOMPILE 绕过坏计划,只为取数)
SELECT N'4 SUM(结存金额) 现有口径' AS k, COUNT(*) AS rows_n, SUM(结存金额) AS total FROM v_stock_balance OPTION (RECOMPILE);
GO
SELECT N'5 SUM(现存量)' AS k, SUM(现存量) AS total FROM v_stock_balance OPTION (RECOMPILE);
GO
