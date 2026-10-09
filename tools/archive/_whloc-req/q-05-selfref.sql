SET NOCOUNT ON;
PRINT N'=== 1. 自参照先例:yj_field.ref_panel = 自己所属 panel_code 的字段 ===';
SELECT f.panel_code, f.col_name, f.label, f.data_type, f.ref_panel, f.ref_field, f.display_field,
       f.place, f.seq, f.hidden, f.visible, p.mode AS 面板模式, p.line_table
FROM yj_field f JOIN yj_panel p ON p.panel_code = f.panel_code
WHERE f.ref_panel = f.panel_code
ORDER BY f.panel_code, f.seq, f.id;
GO
PRINT N'=== 2. 全库 参照 字段的 ref_panel 分布(看哪些面板被参照) ===';
SELECT ref_panel, COUNT(*) AS 引用字段数, COUNT(DISTINCT panel_code) AS 来源面板数
FROM yj_field WHERE data_type = N'参照' AND ref_panel IS NOT NULL
GROUP BY ref_panel ORDER BY COUNT(*) DESC;
GO
PRINT N'=== 3. DEPT 面板字段(自参照范例) ===';
SELECT id, col_name, label, data_type, ref_panel, ref_field, display_field, place, seq, editable, hidden, visible
FROM yj_field WHERE panel_code='DEPT' ORDER BY seq, id;
GO
PRINT N'=== 4. bs_dept 列 + 行数 ===';
SELECT c.name AS 列, ty.name AS 类型 FROM sys.columns c JOIN sys.types ty ON ty.user_type_id=c.user_type_id
WHERE c.object_id=OBJECT_ID('dbo.bs_dept') ORDER BY c.column_id;
SELECT COUNT(*) AS bs_dept行数 FROM dbo.bs_dept;
GO
PRINT N'=== 5. 参照字段是否支持级联/过滤(看 yj_field 有无相关列) ===';
SELECT c.name AS yj_field列, ty.name AS 类型 FROM sys.columns c JOIN sys.types ty ON ty.user_type_id=c.user_type_id
WHERE c.object_id=OBJECT_ID('dbo.yj_field') ORDER BY c.column_id;
GO
PRINT N'=== 6. archive 模式面板清单(看库位所属的模式族) ===';
SELECT panel_code, panel_name, category, mode, line_table, page_size, detail_key
FROM yj_panel WHERE mode='archive' ORDER BY panel_code;
GO
PRINT N'=== 7. WHLOC 是否被任何字段参照 ===';
SELECT panel_code, col_name, label, data_type, ref_panel, ref_field FROM yj_field WHERE ref_panel='WHLOC';
GO
