SET NOCOUNT ON;
DECLARE @dup int;
SELECT @dup = COUNT(*) FROM (
  SELECT panel_code, label FROM yj_field
  WHERE panel_code IN (N'STOCK_BALANCE', N'STOCK_LEDGER', N'STOCK_SUMMARY')
  GROUP BY panel_code, label HAVING COUNT(*) > 1) d;

DECLARE @bal int = (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'STOCK_BALANCE');
DECLARE @led int = (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'STOCK_LEDGER');
DECLARE @sum int = (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'STOCK_SUMMARY');
DECLARE @det int = (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'STOCK_DETAIL');
DECLARE @c2 int = (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'STOCK_LEDGER' AND col_name IN (N'开始日期', N'结束日期'));
DECLARE @c2b int = (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'STOCK_SUMMARY' AND col_name IN (N'开始日期', N'结束日期'));
DECLARE @c4a int = (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'STOCK_BALANCE'
      AND col_name IN (N'仓库', N'存货') AND place LIKE N'%query%' AND ref_panel IN (N'WH', N'INV'));
DECLARE @c4b int = (SELECT COUNT(*) FROM yj_field WHERE panel_code IN (N'STOCK_LEDGER', N'STOCK_SUMMARY')
      AND col_name IN (N'仓库', N'存货') AND place LIKE N'%query%' AND ref_panel IN (N'WH', N'INV'));
DECLARE @c5 int = (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'STOCK_BALANCE' AND place LIKE N'%query%');

DECLARE @bad int = 0;
IF @dup <> 0 SET @bad += 1;
IF @c2 + @c2b > 0 SET @bad += 1;
IF @bal <> 9 SET @bad += 1;
IF @led <> 29 SET @bad += 1;
IF @sum <> 19 SET @bad += 1;
IF @det <> 9 SET @bad += 1;
IF @c4a <> 2 SET @bad += 1;
IF @c4b <> 4 SET @bad += 1;
IF @c5 <> 4 SET @bad += 1;

SELECT DB_NAME() AS db, @dup AS dup_groups, @bal AS bal, @led AS led, @sum AS summ, @det AS det,
       @c2 AS daterow_led, @c2b AS daterow_sum, @c4a AS bal_ref_q, @c4b AS led_sum_ref_q,
       @c5 AS bal_query_rows, @bad AS bad_items;
