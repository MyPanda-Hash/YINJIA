SET NOCOUNT ON;
SELECT c.column_id, c.name, t.name AS type_name, c.max_length, c.is_nullable, c.is_identity
FROM sys.columns c JOIN sys.types t ON c.user_type_id = t.user_type_id
WHERE c.object_id = OBJECT_ID('dbo.bs_op') ORDER BY c.column_id;
GO
SELECT id, 工序编码, 工序名称, 状态, 是否停用, asp_cancel, asp_user1, asp_time1
FROM dbo.bs_op ORDER BY 工序编码, id;
GO
SELECT 工序编码, COUNT(*) AS 行数, MIN(id) AS 首行, MAX(id) AS 末行,
       SUM(CASE WHEN ISNULL(asp_cancel,'N')='Y' THEN 1 ELSE 0 END) AS 已作废行
FROM dbo.bs_op GROUP BY 工序编码 HAVING COUNT(*) > 1 ORDER BY 行数 DESC, 工序编码;
GO
SELECT COUNT(*) AS bs_op总行数, COUNT(DISTINCT 工序编码) AS 去重编码数 FROM dbo.bs_op;
GO
SELECT f.id, f.panel_code, f.col_name, f.label, f.data_type, f.place, f.seq, f.required, f.visible, f.hidden
FROM dbo.yj_field f WHERE f.panel_code = 'OP' ORDER BY f.seq, f.id;
GO
SELECT p.panel_code, p.panel_name, p.mode, p.line_table, p.pk_col, p.code_col, p.detail_key, p.category, p.module_group
FROM dbo.yj_panel p WHERE p.panel_code IN ('OP','ROUTE','OP_TIME');
GO
