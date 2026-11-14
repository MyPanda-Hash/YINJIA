/* probe-04-verify.sql — 落库后实测取证(只读;两账套同跑) */
SET NOCOUNT ON;
PRINT '=== [1] 两表是否存在 + 列数实测 ===';
SELECT t.name AS 表名, COUNT(c.column_id) AS 列数
FROM sys.tables t JOIN sys.columns c ON c.object_id = t.object_id
WHERE t.name IN (N'qc_line_patrol_head', N'qc_line_patrol_detail')
GROUP BY t.name ORDER BY t.name;

PRINT '=== [2] 列清单(逐列类型/长度/可空) ===';
SELECT t.name AS 表名, c.column_id AS 序, c.name AS 列名, ty.name AS 类型,
       CASE WHEN c.max_length = -1 THEN -1 ELSE c.max_length END AS 字节长, c.is_nullable AS 可空
FROM sys.tables t JOIN sys.columns c ON c.object_id = t.object_id
JOIN sys.types ty ON ty.user_type_id = c.user_type_id
WHERE t.name IN (N'qc_line_patrol_head', N'qc_line_patrol_detail')
ORDER BY t.name, c.column_id;

PRINT '=== [3] 主键 / 索引 / 默认约束(库兼容级别 100,不用 STRING_AGG) ===';
SELECT t.name AS 表名, i.name AS 索引名, i.type_desc AS 类型, i.is_primary_key AS 主键,
       ic.key_ordinal AS 键序, c.name AS 列
FROM sys.tables t JOIN sys.indexes i ON i.object_id = t.object_id
JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id AND ic.is_included_column = 0
JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
WHERE t.name IN (N'qc_line_patrol_head', N'qc_line_patrol_detail')
ORDER BY t.name, i.name, ic.key_ordinal;
SELECT OBJECT_NAME(dc.parent_object_id) AS 表名, dc.name AS 默认约束, c.name AS 列名, dc.definition AS 定义
FROM sys.default_constraints dc JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
WHERE dc.parent_object_id IN (OBJECT_ID(N'dbo.qc_line_patrol_head'), OBJECT_ID(N'dbo.qc_line_patrol_detail'));

PRINT '=== [4] MS_Description 中文注明(表级 + 列级条数) ===';
SELECT OBJECT_NAME(ep.major_id) AS 表名,
       SUM(CASE WHEN ep.minor_id = 0 THEN 1 ELSE 0 END) AS 表级条数,
       SUM(CASE WHEN ep.minor_id > 0 THEN 1 ELSE 0 END) AS 列级条数
FROM sys.extended_properties ep
WHERE ep.major_id IN (OBJECT_ID(N'dbo.qc_line_patrol_head'), OBJECT_ID(N'dbo.qc_line_patrol_detail'))
  AND ep.name = N'MS_Description' GROUP BY ep.major_id;

PRINT '=== [5] 面板 yj_panel 一行 ===';
SELECT panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group
FROM yj_panel WHERE panel_code = N'QC_LINE_PATROL';

PRINT '=== [6] 头字段 5 行 ===';
SELECT col_name, label, data_type, place, seq, width, editable, required, hidden, visible
FROM yj_field WHERE panel_code = N'QC_LINE_PATROL' AND place LIKE N'%header%' ORDER BY seq;

PRINT '=== [7] 明细字段 25 行 ===';
SELECT col_name, label, data_type, place, seq, width, editable, required, hidden, visible
FROM yj_field WHERE panel_code = N'QC_LINE_PATROL' AND place LIKE N'%detail%' ORDER BY seq;

PRINT '=== [8] 字段总数 / 隐藏数 ===';
SELECT COUNT(*) AS 字段总数, SUM(CASE WHEN hidden = 1 THEN 1 ELSE 0 END) AS 隐藏字段
FROM yj_field WHERE panel_code = N'QC_LINE_PATROL';

PRINT '=== [9] 角色授权(照抄 QC_OQC_REPORT) ===';
SELECT rp.role_id, r.role_code, r.role_name, rp.can_approve, rp.perms
FROM yj_role_panel rp LEFT JOIN yj_role r ON r.id = rp.role_id
WHERE rp.panel_code = N'QC_LINE_PATROL' ORDER BY rp.role_id;

PRINT '=== [10] 面板 en 译名 + 字段 en 译名(应 21 条) ===';
SELECT scope, ref_key, locale, text, source FROM yj_translation
WHERE locale = N'en' AND ((scope = N'panel' AND ref_key = N'成型车间巡线记录表')
   OR (scope = N'field' AND ref_key IN (N'巡线时间', N'编号1', N'型号1', N'长度标准1', N'长度实测1', N'内径标准1', N'内径实测1',
        N'重量标准1', N'重量实测1', N'编号2', N'型号2', N'长度标准2', N'长度实测2', N'内径标准2', N'内径实测2', N'重量标准2', N'重量实测2',
        N'两液密度', N'表面状态', N'结果判定', N'巡线人员')))
ORDER BY scope, ref_key;

PRINT '=== [11] 本面板字段标签缺 en 译名数(必须 0) ===';
SELECT COUNT(*) AS 缺译名标签数 FROM yj_field f WHERE f.panel_code = N'QC_LINE_PATROL'
  AND NOT EXISTS (SELECT 1 FROM yj_translation t WHERE t.scope = N'field' AND t.ref_key = f.label AND t.locale = N'en');

PRINT '=== [12] 跌落强度/抗压强度 占位回填结果 ===';
SELECT ref_key, text, source FROM yj_translation WHERE scope = N'field' AND locale = N'en' AND ref_key IN (N'跌落强度', N'抗压强度');

PRINT '=== [13] 迁移链登记 yj_schema_log ===';
SELECT script_name, LEFT(content_hash, 16) AS 哈希前16, applied_at FROM yj_schema_log
WHERE script_name = N'migrate-qc-line-patrol-20261114.sql';

PRINT '=== [14] 元数据漂移自检(本面板字段必须都在对应物理对象里;必须 0) ===';
SELECT COUNT(*) AS 漂移字段数
FROM yj_field f
JOIN yj_panel p ON p.panel_code = f.panel_code
WHERE f.panel_code = N'QC_LINE_PATROL'
  AND ( (f.place LIKE N'%header%' AND COL_LENGTH(N'dbo.' + p.head_table, f.col_name) IS NULL)
     OR (f.place NOT LIKE N'%header%' AND f.place LIKE N'%detail%' AND COL_LENGTH(N'dbo.' + p.line_table, f.col_name) IS NULL) );

PRINT '=== [15] 重复登记行自检(必须 0) ===';
SELECT COUNT(*) AS 重复行数 FROM (
  SELECT panel_code, col_name, place, seq, COUNT(*) AS n FROM yj_field
  WHERE panel_code = N'QC_LINE_PATROL' GROUP BY panel_code, col_name, place, seq HAVING COUNT(*) > 1
) x;
GO
