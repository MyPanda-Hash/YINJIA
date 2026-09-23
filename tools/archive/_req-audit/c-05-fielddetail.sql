SET NOCOUNT ON;
-- 每面板一行:字段清单拼接(列名(标签)[位置/编辑/必填/隐藏/参照])
SELECT f.panel_code AS 面板,
       STUFF((SELECT N' || ' + g.col_name + N'(' + g.label + N')[' + ISNULL(g.place,N'-') + N',e' + CAST(g.editable AS varchar(2))
                     + N',r' + CAST(g.required AS varchar(2)) + N',h' + CAST(g.hidden AS varchar(2))
                     + CASE WHEN g.ref_panel IS NOT NULL AND LTRIM(RTRIM(g.ref_panel)) <> N'' THEN N',ref=' + g.ref_panel + N'/' + ISNULL(g.ref_field,N'') + N'/' + ISNULL(g.display_field,N'') ELSE N'' END
                     + CASE WHEN g.dict_sql IS NOT NULL AND LTRIM(RTRIM(g.dict_sql)) <> N'' THEN N',DICT' ELSE N'' END + N']'
              FROM yj_field g WHERE g.panel_code = f.panel_code
              ORDER BY g.place, g.seq FOR XML PATH(''), TYPE).value('.', 'nvarchar(max)'), 1, 4, N'') AS 字段清单
FROM (SELECT DISTINCT panel_code FROM yj_field WHERE panel_code IN ('QC_INSP','QC_RECV','QC_RETURN','QC_TC','QC_JJF')) f
ORDER BY f.panel_code;
GO
