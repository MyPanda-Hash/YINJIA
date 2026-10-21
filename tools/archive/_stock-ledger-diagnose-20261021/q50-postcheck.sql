SET NOCOUNT ON;
-- 修复后自洽性:现存量是否 = 累计入库 − 累计出库;有没有负数累计
SELECT 检查 = '库存明细 现存量 <> 入-出 的行数', 值 = COUNT(*) FROM v_stock_kucun WHERE ABS(现存量 - (累计入库量 - 累计出库量)) > 0.0001
UNION ALL
SELECT 'kucun 累计入库为负的行数', COUNT(*) FROM kucun WHERE rkl < 0
UNION ALL
SELECT 'kucun 累计出库为负的行数', COUNT(*) FROM kucun WHERE ckl < 0
UNION ALL
SELECT 'kucun yl <> rkl-ckl 的行数', COUNT(*) FROM kucun WHERE ABS(yl - (rkl - ckl)) > 0.0001
UNION ALL
SELECT 'kucun 零行', COUNT(*) FROM kucun WHERE yl = 0
UNION ALL
SELECT 'v_stock_kucun 行数', COUNT(*) FROM v_stock_kucun;
