SET NOCOUNT ON;
PRINT N'=== A. yj_field 里 WH 面板字段(名称/可编辑/隐藏) ===';
SELECT seq, col_name, label, place, editable, required, hidden, visible, data_type
FROM yj_field WHERE panel_code = N'WH' ORDER BY seq;
GO
PRINT N'=== B. yj_translation 已有 库位/仓位 词条 ===';
SELECT scope, ref_key, locale, text, source FROM yj_translation
WHERE ref_key LIKE N'%库位%' OR ref_key LIKE N'%仓位%' OR text LIKE N'%location%' OR text LIKE N'%Location%'
ORDER BY ref_key, locale;
GO
PRINT N'=== C. yj_translation 是否已有 仓库编码/仓库名称 词条 ===';
SELECT scope, ref_key, locale, text FROM yj_translation
WHERE ref_key IN (N'仓库编码', N'仓库名称', N'仓库地址', N'负责人') ORDER BY ref_key, locale;
GO
PRINT N'=== D. WH 面板菜单/权限引用数 ===';
SELECT COUNT(*) FROM yj_role_panel WHERE panel_code = N'WH';
GO
