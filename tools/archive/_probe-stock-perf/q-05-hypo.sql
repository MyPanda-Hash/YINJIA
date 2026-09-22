SET NOCOUNT ON;
SELECT 'STATS' AS k, OBJECT_NAME(s.object_id) AS tbl, s.name AS stat, s.auto_created, s.no_recompute
  FROM sys.stats s WHERE OBJECT_NAME(s.object_id) IN ('bl_purchase_in','bd_purchase_in','bl_sale_out','bd_sale_out','bs_wh','inv_cost_ledger')
 ORDER BY 2,3;
SELECT 'AUTO' AS k, name, is_auto_create_stats_on, is_auto_update_stats_on, is_auto_update_stats_async_on
  FROM sys.databases WHERE name=DB_NAME();
GO
DECLARE @t datetime2; SET @t=SYSDATETIME();
SELECT COUNT(*) AS n FROM v_stock_movement OPTION (RECOMPILE);
SELECT N'A v_stock_movement RECOMPILE' AS k, DATEDIFF(ms,@t,SYSDATETIME()) AS ms;
GO
DECLARE @t datetime2; SET @t=SYSDATETIME();
SELECT COUNT(*) AS n FROM v_stock_movement OPTION (HASH JOIN, RECOMPILE);
SELECT N'B v_stock_movement HASH+RECOMPILE' AS k, DATEDIFF(ms,@t,SYSDATETIME()) AS ms;
GO
DECLARE @t datetime2; SET @t=SYSDATETIME();
SELECT * INTO #m FROM v_stock_movement;
SELECT N'C SELECT * INTO #m FROM v_stock_movement' AS k, DATEDIFF(ms,@t,SYSDATETIME()) AS ms, COUNT(*) AS n FROM #m;
GO
DECLARE @t datetime2; SET @t=SYSDATETIME();
SELECT COUNT(*) AS n FROM v_stock_balance OPTION (RECOMPILE);
SELECT N'D v_stock_balance RECOMPILE' AS k, DATEDIFF(ms,@t,SYSDATETIME()) AS ms;
GO
