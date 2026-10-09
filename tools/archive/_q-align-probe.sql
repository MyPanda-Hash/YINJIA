-- 对齐任务探针:yj_field 列清单 + 四单面板与物理表(2026-10-07)
SET NOCOUNT ON;
SELECT c.column_id AS 序, c.name AS 列名, t.name AS 类型, c.max_length / 2 AS 字符数, c.is_nullable AS 可空
FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID('dbo.yj_field') ORDER BY c.column_id;
GO
SELECT RTRIM(panel_code) AS 面板, COUNT(*) AS 字段行数 FROM yj_field WHERE RTRIM(panel_code) IN ('QC_RECV','QC_INSP','QC_RETURN','PURCHASE_IN') GROUP BY panel_code ORDER BY panel_code;
GO
SELECT RTRIM(panel_code) AS 面板, panel_name, line_table, head_table, detail_key FROM yj_panel WHERE RTRIM(panel_code) IN ('QC_RECV','QC_INSP','QC_RETURN','PURCHASE_IN');
GO
