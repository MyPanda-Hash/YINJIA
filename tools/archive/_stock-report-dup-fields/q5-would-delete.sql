-- q5-would-delete.sql — 修复前「将要删除哪些行」的取证(两账套各跑一次,只读)
SET NOCOUNT ON;
DECLARE @panels TABLE (panel_code varchar(40) PRIMARY KEY);
INSERT INTO @panels VALUES ('STOCK_BALANCE'),('STOCK_LEDGER'),('STOCK_SUMMARY');

PRINT '== 1. 库存报表三面板的字段行(含 id/place/ref,观察谁多出来) ==';
SELECT f.panel_code, f.id, f.col_name, f.label, f.data_type, f.place, f.seq, f.width,
       ISNULL(f.ref_panel,'-') AS ref_panel, ISNULL(f.ref_field,'-') AS ref_field, f.visible
FROM yj_field f JOIN @panels p ON p.panel_code = f.panel_code
ORDER BY f.panel_code, f.seq, f.id;

PRINT '== 2. 规则 A 命中:同面板同 label 多行 —— 删除 place 不含 query 的「后注册」行 ==';
SELECT f.panel_code, f.id AS 删除行, f.col_name, f.label, f.place AS 删除行place, f.seq AS 删除行seq,
       g.id AS 保留行, g.place AS 保留行place, g.seq AS 保留行seq, g.ref_panel AS 保留行ref
FROM yj_field f
JOIN yj_field g ON g.panel_code = f.panel_code AND g.label = f.label AND g.id < f.id
WHERE f.panel_code IN (SELECT panel_code FROM @panels)
  AND f.place NOT LIKE '%query%' AND g.place LIKE '%query%'
ORDER BY f.panel_code, f.label;

PRINT '== 3. 规则 B 命中:开始日期/结束日期 残留字段行(口径:migrate-report-dialog-fields.sql 应已删除) ==';
SELECT panel_code, id, col_name, label, place, seq, width
FROM yj_field
WHERE panel_code IN ('STOCK_LEDGER','STOCK_SUMMARY') AND col_name IN (N'开始日期', N'结束日期')
ORDER BY panel_code, col_name;

PRINT '== 4. 规则 A 会不会误伤其它 place 组合?同面板同 label 但两行 place 都含 query 的情况 ==';
SELECT f.panel_code, f.label, COUNT(*) AS 行数
FROM yj_field f JOIN @panels p ON p.panel_code = f.panel_code
GROUP BY f.panel_code, f.label HAVING COUNT(*) > 1 AND SUM(CASE WHEN f.place LIKE '%query%' THEN 1 ELSE 0 END) > 1;
