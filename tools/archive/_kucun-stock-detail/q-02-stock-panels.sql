-- q-11-stock-panels.sql — 三张库存报表 / STOCK_STATUS 的面板登记与字段(新「库存明细」的挂载参照)
SET NOCOUNT ON;
SELECT N'面板' AS k, panel_code, panel_name, mode, category, module_group, head_table, line_table, code_col, date_col, prefix, page_size, detail_key,
       LEFT(CAST(config AS nvarchar(600)), 600) AS config_head
FROM yj_panel
WHERE panel_code IN ('STOCK_BALANCE','STOCK_LEDGER','STOCK_SUMMARY','STOCK_STATUS','KUCUN','STOCK_DETAIL')
   OR panel_name LIKE N'%库存%';
GO
SELECT N'字段数' AS k, panel_code, COUNT(*) AS 字段数, SUM(CASE WHEN visible = 1 AND hidden = 0 THEN 1 ELSE 0 END) AS 可见列
FROM yj_field WHERE panel_code IN ('STOCK_BALANCE','STOCK_LEDGER','STOCK_SUMMARY','STOCK_STATUS')
GROUP BY panel_code;
GO
SELECT N'STOCK_BALANCE 字段' AS k, place, seq, col_name, label, data_type, width, editable, hidden, visible
FROM yj_field WHERE panel_code = 'STOCK_BALANCE' ORDER BY place, seq, id;
GO
SELECT N'STOCK_STATUS 字段' AS k, place, seq, col_name, label, data_type, width, editable, hidden, visible
FROM yj_field WHERE panel_code = 'STOCK_STATUS' ORDER BY place, seq, id;
GO
SELECT N'引用 kucun 的对象' AS k, o.type_desc, o.name
FROM sys.objects o WHERE o.type IN ('V','P','FN','TF','IF') AND OBJECT_DEFINITION(o.object_id) LIKE '%kucun%'
ORDER BY o.type_desc, o.name;
GO
