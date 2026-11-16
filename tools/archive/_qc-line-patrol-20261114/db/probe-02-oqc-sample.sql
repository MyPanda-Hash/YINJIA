/* probe-02-oqc-sample.sql — 只读探针:取 QC_OQC_REPORT(最近新增且已验证可用的品质面板)的字段口径做样板 */
SET NOCOUNT ON;
PRINT '=== [1] QC_OQC_REPORT 字段(按 place,seq) ===';
SELECT id, col_name, label, data_type, place, seq, width, editable, required, hidden, visible, dict_sql
FROM yj_field WHERE panel_code = N'QC_OQC_REPORT' ORDER BY place, seq;

PRINT '=== [2] yj_panel.config 是否有内容 ===';
SELECT panel_code, panel_name_en, config FROM yj_panel WHERE panel_code IN (N'QC_OQC_REPORT', N'QC_FIRST_INSP', N'QC_ASM_INSP');

PRINT '=== [3] 面板引擎:yj_translation 唯一键约束 ===';
SELECT i.name AS 索引名, i.is_unique, c.name AS 列名
FROM sys.indexes i JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
WHERE i.object_id = OBJECT_ID(N'dbo.yj_translation') ORDER BY i.index_id, ic.key_ordinal;

PRINT '=== [4] 现有已用单号前缀(避重号) ===';
SELECT lb AS 前缀, ny AS 年月, COUNT(*) AS 条数 FROM s_allno GROUP BY lb, ny ORDER BY lb, ny;

PRINT '=== [5] qc_first_insp_head 的 asp_cancel 默认约束与主键命名(样板) ===';
SELECT dc.name AS 默认约束, c.name AS 列名 FROM sys.default_constraints dc
JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
WHERE dc.parent_object_id = OBJECT_ID(N'dbo.qc_first_insp_head');

PRINT '=== [6] qc 面板行里 category/module_group 分布 ===';
SELECT category, module_group, COUNT(*) AS 面板数 FROM yj_panel WHERE panel_code LIKE N'QC[_]%' GROUP BY category, module_group;
GO
