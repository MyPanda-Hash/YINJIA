-- 一次性探针(2026-10-05):来料检验单 QC_INSP 表头字段现状 + 部门/部门编码 全库口径比对
SET NOCOUNT ON;
PRINT N'=== 1. QC_INSP 全部字段行(按 place/seq) ===';
SELECT id, place, seq, col_name, label, data_type, hidden, visible, editable, ref_panel, ref_field, display_field
FROM yj_field WHERE panel_code = 'QC_INSP' ORDER BY place, seq, id;
GO
PRINT N'=== 2. qc_insp 表列(部门/编码相关) ===';
SELECT c.name AS col, t.name AS dtype, c.max_length, c.is_nullable
FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID('dbo.qc_insp') AND (c.name LIKE N'%部门%' OR c.name LIKE N'%编码%')
ORDER BY c.column_id;
GO
PRINT N'=== 3. 全库表头位 部门/部门编码/部门名称 字段行(比对口径) ===';
SELECT panel_code, col_name, label, place, seq, data_type, ref_panel, ref_field, display_field, hidden
FROM yj_field
WHERE col_name IN (N'部门', N'部门编码', N'部门名称') AND place LIKE '%header%'
ORDER BY col_name, panel_code, seq;
GO
PRINT N'=== 4. 全库同名重复占 header 位的(重复渲染风险) ===';
SELECT panel_code, col_name, COUNT(*) cnt FROM yj_field
WHERE place LIKE '%header%' GROUP BY panel_code, col_name HAVING COUNT(*) > 1 ORDER BY panel_code;
GO
