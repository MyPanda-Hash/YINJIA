/* probe-01-preexisting.sql — 只读探针(巡线检验 DB 负责人,2026-11-14)
 * 目的:落库前摸清既有口径,避免照抄错样板。
 * 用法(tools 目录):java -cp lib/mssql-jdbc.jar SqlRunner.java "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false" yinjia env archive/_qc-line-patrol-20261114/db/probe-01-preexisting.sql
 */
SET NOCOUNT ON;

PRINT '=== [1] yj_panel 列结构 ===';
SELECT c.column_id AS 序, c.name AS 列名, t.name AS 类型,
       CASE WHEN c.max_length = -1 THEN -1 ELSE c.max_length END AS 长度, c.is_nullable AS 可空
FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID(N'dbo.yj_panel') ORDER BY c.column_id;

PRINT '=== [2] yj_panel 现有品质类面板行(QC_ 前缀) ===';
SELECT panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group
FROM yj_panel WHERE panel_code LIKE N'QC[_]%' ORDER BY panel_code;

PRINT '=== [3] yj_field 列结构 ===';
SELECT c.column_id AS 序, c.name AS 列名, t.name AS 类型, c.max_length AS 长度, c.is_nullable AS 可空
FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID(N'dbo.yj_field') ORDER BY c.column_id;

PRINT '=== [4] yj_field QC_FIRST_INSP 头字段样板 ===';
SELECT id, panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible
FROM yj_field WHERE panel_code = N'QC_FIRST_INSP' AND place LIKE N'%header%' ORDER BY seq;

PRINT '=== [5] yj_field QC_FIRST_INSP 明细字段样板 ===';
SELECT id, panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible
FROM yj_field WHERE panel_code = N'QC_FIRST_INSP' AND place LIKE N'%detail%' ORDER BY seq;

PRINT '=== [6] yj_role_panel 列结构 + 现有角色 ===';
SELECT c.column_id AS 序, c.name AS 列名, t.name AS 类型, c.max_length AS 长度, c.is_nullable AS 可空
FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID(N'dbo.yj_role_panel') ORDER BY c.column_id;

PRINT '=== [7] yj_role 角色清单 ===';
SELECT id, role_code, role_name, is_admin FROM yj_role ORDER BY id;

PRINT '=== [8] yj_role_panel QC_OQC_REPORT / QC_FIRST_INSP 现有授权行 ===';
SELECT rp.id, rp.role_id, r.role_code, r.role_name, rp.panel_code, rp.can_approve, rp.perms
FROM yj_role_panel rp LEFT JOIN yj_role r ON r.id = rp.role_id
WHERE rp.panel_code IN (N'QC_OQC_REPORT', N'QC_FIRST_INSP', N'QC_PROC_INSP')
ORDER BY rp.panel_code, rp.role_id;

PRINT '=== [9] 目标标签的现有 en 译名(有则不再插) ===';
SELECT scope, ref_key, locale, text, source FROM yj_translation
WHERE locale = N'en' AND (
   (scope = N'field' AND ref_key IN (N'单据编号', N'单据日期', N'审核人', N'审核时间', N'单据状态', N'备注', N'行号',
       N'巡线时间', N'车间', N'编号1', N'型号1', N'长度标准1', N'长度实测1', N'内径标准1', N'内径实测1',
       N'重量标准1', N'重量实测1', N'编号2', N'型号2', N'长度标准2', N'长度实测2', N'内径标准2', N'内径实测2',
       N'重量标准2', N'重量实测2', N'两液密度', N'表面状态', N'跌落强度', N'抗压强度', N'结果判定', N'巡线人员'))
OR (scope = N'panel' AND ref_key = N'成型车间巡线记录表')
) ORDER BY scope, ref_key;

PRINT '=== [10] 已有表/视图是否撞名 ===';
SELECT o.name, o.type_desc FROM sys.objects o
WHERE o.name IN (N'qc_line_patrol_head', N'qc_line_patrol_detail');

PRINT '=== [11] 号池 s_allno 前缀现状(XJ 是否可用) ===';
SELECT * FROM s_allno WHERE 1 = 0;

PRINT '=== [12] 现有 qc_ 表列数实测(供台账对照) ===';
SELECT t.name AS 表名, COUNT(c.column_id) AS 列数
FROM sys.tables t JOIN sys.columns c ON c.object_id = t.object_id
WHERE t.name LIKE N'qc[_]%' GROUP BY t.name ORDER BY t.name;
GO
