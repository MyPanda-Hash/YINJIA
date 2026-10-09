SET NOCOUNT ON;
PRINT N'-- 目标行全列:PURCHASE_IN 明细「仓位名称」/ WHLOC「停用」/ INV「默认仓位」';
SELECT id, panel_code, col_name, label, ISNULL(label_en, N'(NULL)') AS label_en, data_type,
       ISNULL(dict_sql, N'') AS dict_sql, ISNULL(ref_panel, N'') AS ref_panel, ISNULL(ref_field, N'') AS ref_field,
       ISNULL(display_field, N'') AS display_field, ISNULL(ref_filter, N'') AS ref_filter,
       place, seq, width, editable, required, hidden, visible,
       ISNULL(alias, N'') AS alias, ISNULL(col_group, N'') AS col_group, ISNULL(tab_key, N'') AS tab_key
  FROM yj_field
 WHERE (panel_code = N'PURCHASE_IN' AND id = 12143)
    OR (panel_code = N'WHLOC' AND col_name = N'停用')
    OR (panel_code = N'INV' AND col_name = N'默认仓位');

PRINT N'-- yj_field 全列清单(写 INSERT 要照这个)';
SELECT c.name AS 列名, t.name AS 类型, c.is_nullable AS 可空, c.is_identity AS 自增
  FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
 WHERE c.object_id = OBJECT_ID('dbo.yj_field') ORDER BY c.column_id;

PRINT N'-- 对照:WHLOC 面板里一个「参照 WH」字段(row参照)怎么登记的';
SELECT id, label, col_name, data_type, ref_panel, ref_field, display_field, ref_filter, place, seq, editable, hidden, visible
  FROM yj_field WHERE panel_code = N'WHLOC' AND ref_panel IS NOT NULL;

PRINT N'-- 对照:一个「参照」类字段的 ref_filter 语法样例(RD_* 的静态等值)';
SELECT panel_code, label, ref_panel, ref_field, display_field, ref_filter
  FROM yj_field WHERE ISNULL(ref_filter, N'') <> N'' ORDER BY panel_code OFFSET 0 ROWS FETCH NEXT 3 ROWS ONLY;
