SET NOCOUNT ON;
PRINT N'=== 1. bs_wh.库位 列 ===';
SELECT c.name, t.name AS typ, c.max_length FROM sys.columns c JOIN sys.types t ON c.user_type_id=t.user_type_id
WHERE c.object_id=OBJECT_ID(N'bs_wh') AND c.name=N'库位';
PRINT N'=== 2. 列注明 ===';
SELECT ep.value FROM sys.extended_properties ep
WHERE ep.major_id=OBJECT_ID(N'bs_wh') AND ep.name=N'MS_Description'
  AND ep.minor_id=COLUMNPROPERTY(ep.major_id, N'库位', 'ColumnId');
GO
PRINT N'=== 3. yj_field WH 库位 ===';
SELECT panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible
FROM yj_field WHERE panel_code=N'WH' AND col_name=N'库位';
GO
PRINT N'=== 4. 译名 9 语言 ===';
SELECT locale, text FROM yj_translation WHERE scope='field' AND ref_key=N'库位' ORDER BY locale;
GO
PRINT N'=== 5. WH 面板字段最终顺序 ===';
SELECT seq, col_name, visible, hidden FROM yj_field WHERE panel_code=N'WH' AND hidden=0 ORDER BY seq;
GO
