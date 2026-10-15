-- q2-state.sql — 库存报表组当前落库状态(字段数、列结构、面板 config)
SET NOCOUNT ON;

PRINT '== 1. yj_field 列结构 ==';
SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'yj_field' ORDER BY ORDINAL_POSITION;

PRINT '== 2. 五面板字段数(全量,不分 place) ==';
SELECT panel_code, COUNT(*) AS 字段数,
       SUM(CASE WHEN place LIKE '%detail%' THEN 1 ELSE 0 END) AS 明细列,
       SUM(CASE WHEN place LIKE '%query%' THEN 1 ELSE 0 END) AS 查询字段,
       SUM(CASE WHEN place LIKE '%header%' THEN 1 ELSE 0 END) AS 表头字段
FROM yj_field
WHERE panel_code IN ('STOCK_BALANCE','STOCK_LEDGER','STOCK_SUMMARY','STOCK_STATUS','STOCK_DETAIL')
GROUP BY panel_code ORDER BY panel_code;

PRINT '== 3. 收发存汇总表 STOCK_SUMMARY 全部字段 ==';
SELECT id, col_name, label, data_type, place, seq, width, hidden
FROM yj_field WHERE panel_code='STOCK_SUMMARY' ORDER BY seq, id;

PRINT '== 4. 各面板 yj_panel 定义(含 report 开关类列) ==';
SELECT * FROM yj_panel WHERE panel_code IN ('STOCK_BALANCE','STOCK_LEDGER','STOCK_SUMMARY','STOCK_STATUS','STOCK_DETAIL');

PRINT '== 5. 报表模板 yj_report_template 是否涉及 ==';
SELECT * FROM yj_report_template WHERE panel_code IN ('STOCK_BALANCE','STOCK_LEDGER','STOCK_SUMMARY','STOCK_STATUS','STOCK_DETAIL');
