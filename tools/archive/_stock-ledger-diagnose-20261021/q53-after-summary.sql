SET NOCOUNT ON;
SELECT 指标 = '库存明细行数', 值 = CAST(COUNT(*) AS decimal(18,4)) FROM v_stock_kucun
UNION ALL SELECT '库存明细 负行', CAST(SUM(CASE WHEN 现存量 < 0 THEN 1 ELSE 0 END) AS decimal(18,4)) FROM v_stock_kucun
UNION ALL SELECT '库存明细 Σ', CAST(SUM(现存量) AS decimal(18,4)) FROM v_stock_kucun
UNION ALL SELECT '库存状况(批次级)行数', CAST(COUNT(*) AS decimal(18,4)) FROM kucun
UNION ALL SELECT '库存状况 负行', CAST(SUM(CASE WHEN yl < 0 THEN 1 ELSE 0 END) AS decimal(18,4)) FROM kucun
UNION ALL SELECT '库存状况 Σ', CAST(SUM(yl) AS decimal(18,4)) FROM kucun
UNION ALL SELECT '库存状况表 行数', CAST(COUNT(*) AS decimal(18,4)) FROM v_stock_balance
UNION ALL SELECT '库存状况表 Σ', CAST(SUM(现存量) AS decimal(18,4)) FROM v_stock_balance;
