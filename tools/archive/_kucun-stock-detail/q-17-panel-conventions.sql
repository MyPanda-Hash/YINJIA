-- q-17-panel-conventions.sql — 新建 STOCK_DETAIL(库存明细,KUCUN 直读)要对齐的先例与配套表
SET NOCOUNT ON;
SELECT N'三张报表面板' AS k, panel_code, panel_name, category, mode, line_table, pk_col, date_col, page_size, detail_key, module_group, panel_name_en
FROM yj_panel WHERE panel_code IN ('STOCK_BALANCE','STOCK_LEDGER','STOCK_SUMMARY');
GO
SELECT N'STOCK_BALANCE 字段全量' AS k, id, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, ref_filter, place, seq, width, editable, required, hidden, visible, alias, label_en, col_group, tab_key
FROM yj_field WHERE panel_code = 'STOCK_BALANCE' ORDER BY place, seq, id;
GO
SELECT N'STOCK_SUMMARY 字段' AS k, id, col_name, label, data_type, ref_panel, ref_field, display_field, place, seq, width, editable, hidden, visible, alias
FROM yj_field WHERE panel_code = 'STOCK_SUMMARY' ORDER BY place, seq, id;
GO
SELECT N'权限表' AS k, t.name AS 表名, (SELECT COUNT(*) FROM sys.columns c WHERE c.object_id = t.object_id) AS 列数
FROM sys.tables t WHERE t.name LIKE '%perm%' OR t.name LIKE '%role%' OR t.name LIKE '%module%' ORDER BY t.name;
GO
SELECT N'库存报表在权限表的登记' AS k, * FROM yj_role_panel WHERE panel_code IN ('STOCK_BALANCE','STOCK_LEDGER','STOCK_SUMMARY','STOCK_STATUS');
GO
SELECT N'需要的译名是否已有' AS k, scope, ref_key, COUNT(*) AS 语言数
FROM yj_translation
WHERE (scope = 'panel' AND ref_key IN (N'库存明细', N'库存状况表')) OR (scope = 'field' AND ref_key IN (N'存货编码', N'仓库', N'批号', N'累计入库', N'累计出库', N'现存量', N'结存单价', N'更新时间', N'累计入库量', N'累计出库量'))
GROUP BY scope, ref_key ORDER BY scope, ref_key;
GO
SELECT N'total_je 是否全 0' AS k, COUNT(*) AS 行数, SUM(CASE WHEN ISNULL(total_je,0) <> 0 THEN 1 ELSE 0 END) AS 非零行,
       SUM(CASE WHEN ISNULL(price2,0) <> 0 THEN 1 ELSE 0 END) AS price2非零行
FROM kucun;
GO
