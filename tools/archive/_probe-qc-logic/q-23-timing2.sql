-- q-23-timing2.sql — 逐项计时(以结果集返回,便于执行器回显)
SET NOCOUNT ON;
DECLARE @r TABLE (obj sysname, rows_n int, ms int, err nvarchar(200));
DECLARE @t datetime2, @n int;

SET @t = SYSDATETIME(); SELECT @n = COUNT(*) FROM yj_panel;
INSERT INTO @r VALUES ('yj_panel', @n, DATEDIFF(ms, @t, SYSDATETIME()), NULL);
SET @t = SYSDATETIME(); SELECT @n = COUNT(*) FROM qc_catalog_detail;
INSERT INTO @r VALUES ('qc_catalog_detail', @n, DATEDIFF(ms, @t, SYSDATETIME()), NULL);
SET @t = SYSDATETIME(); SELECT @n = COUNT(*) FROM qc_insp;
INSERT INTO @r VALUES ('qc_insp', @n, DATEDIFF(ms, @t, SYSDATETIME()), NULL);
SET @t = SYSDATETIME(); SELECT @n = COUNT(*) FROM bs_inv;
INSERT INTO @r VALUES ('bs_inv', @n, DATEDIFF(ms, @t, SYSDATETIME()), NULL);
SET @t = SYSDATETIME(); SELECT @n = COUNT(*) FROM inv_cost_ledger;
INSERT INTO @r VALUES ('inv_cost_ledger', @n, DATEDIFF(ms, @t, SYSDATETIME()), NULL);
SET @t = SYSDATETIME(); SELECT @n = COUNT(*) FROM v_stock_movement;
INSERT INTO @r VALUES ('v_stock_movement', @n, DATEDIFF(ms, @t, SYSDATETIME()), NULL);
SET @t = SYSDATETIME(); SELECT @n = COUNT(*) FROM v_stock_balance;
INSERT INTO @r VALUES ('v_stock_balance', @n, DATEDIFF(ms, @t, SYSDATETIME()), NULL);
SET @t = SYSDATETIME(); SELECT @n = COUNT(*) FROM v_stock_ledger;
INSERT INTO @r VALUES ('v_stock_ledger', @n, DATEDIFF(ms, @t, SYSDATETIME()), NULL);

SELECT '逐项耗时' AS k, obj, rows_n, ms FROM @r ORDER BY ms DESC;
GO
