SET NOCOUNT ON;
PRINT N'=== yj_field 表结构 ===';
SELECT c.column_id, c.name, t.name AS dtype, c.max_length, c.is_nullable, c.is_identity
FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID('dbo.yj_field') ORDER BY c.column_id;
GO
PRINT N'=== yj_translation:部门/部门编码 已有译名 ===';
SELECT scope, ref_key, locale, text, source FROM yj_translation
WHERE ref_key IN (N'部门', N'部门名称', N'部门编码') ORDER BY ref_key, scope, locale;
GO
PRINT N'=== qc_insp 现有 部门/供应商代码 列定义(比对新列口径) ===';
SELECT c.name, t.name AS dtype, c.max_length, c.is_nullable,
       dc.definition AS default_def
FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
LEFT JOIN sys.default_constraints dc ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id
WHERE c.object_id = OBJECT_ID('dbo.qc_insp') AND c.name IN (N'部门', N'部门名称', N'部门编码', N'供应商代码', N'业务员')
ORDER BY c.column_id;
GO
PRINT N'=== DEPT 面板登记(yj_panel) ===';
SELECT panel_code, panel_name, mode, head_table, line_table, group_col, code_col FROM yj_panel WHERE panel_code = 'DEPT';
GO
PRINT N'=== bs_dept 行数 + 样例 ===';
SELECT COUNT(*) AS 部门档案行数 FROM bs_dept;
GO
SELECT TOP 5 部门编码, 部门名称, 停用 FROM bs_dept ORDER BY 部门编码;
GO
