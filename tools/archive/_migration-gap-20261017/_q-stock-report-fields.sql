SET NOCOUNT ON;
SELECT panel_code, COUNT(*) AS fields,
       SUM(CASE WHEN place LIKE N'%query%' THEN 1 ELSE 0 END) AS query_rows
FROM yj_field
WHERE panel_code IN (N'STOCK_BALANCE', N'STOCK_LEDGER', N'STOCK_SUMMARY', N'STOCK_DETAIL')
GROUP BY panel_code ORDER BY panel_code;

SELECT panel_code, label, COUNT(*) AS n FROM yj_field
WHERE panel_code IN (N'STOCK_BALANCE', N'STOCK_LEDGER', N'STOCK_SUMMARY')
GROUP BY panel_code, label HAVING COUNT(*) > 1 ORDER BY panel_code, label;

SELECT panel_code, col_name, label, place, ref_panel, seq, id FROM yj_field
WHERE panel_code IN (N'STOCK_BALANCE', N'STOCK_LEDGER', N'STOCK_SUMMARY')
  AND col_name IN (N'仓库', N'存货', N'仓库编码', N'存货编码', N'开始日期', N'结束日期')
ORDER BY panel_code, col_name, id;
