-- q1-fields.sql — 库存报表组各面板字段清单(排查「字段重复」)
SET NOCOUNT ON;

PRINT '== 1. 库存报表组面板定义 ==';
SELECT p.panel_code, p.panel_name, p.mode, p.line_table, p.category
FROM yj_panel p
WHERE p.panel_code IN ('STOCK_BALANCE','STOCK_LEDGER','STOCK_SUMMARY','STOCK_STATUS','STOCK_DETAIL')
ORDER BY p.panel_code;

PRINT '== 2. 库存报表组字段明细(按 label/place 观察重复) ==';
SELECT f.panel_code, f.id, f.col_name, f.label, f.data_type, f.place, f.seq, f.width,
       f.hidden, f.ref_panel, f.ref_field, f.display_field
FROM yj_field f
WHERE f.panel_code IN ('STOCK_BALANCE','STOCK_LEDGER','STOCK_SUMMARY','STOCK_STATUS','STOCK_DETAIL')
ORDER BY f.panel_code, f.seq, f.id;

PRINT '== 3. 重复检测:同一面板 + 同一 place 下 label 重复 ==';
SELECT f.panel_code, f.place, f.label, COUNT(*) AS cnt,
       STRING_AGG(CAST(f.id AS varchar(10)) + ':' + f.col_name, ' , ') AS rows_detail
FROM yj_field f
GROUP BY f.panel_code, f.place, f.label
HAVING COUNT(*) > 1
ORDER BY f.panel_code, f.place, f.label;

PRINT '== 4. 重复检测:同一面板下 col_name 重复(跨 place 也算) ==';
SELECT f.panel_code, f.col_name, COUNT(*) AS cnt,
       STRING_AGG(CAST(f.id AS varchar(10)) + ':' + f.place + ':seq' + CAST(f.seq AS varchar(10)), ' , ') AS rows_detail
FROM yj_field f
GROUP BY f.panel_code, f.col_name
HAVING COUNT(*) > 1
ORDER BY f.panel_code, f.col_name;
