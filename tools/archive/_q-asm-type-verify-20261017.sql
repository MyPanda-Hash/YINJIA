-- 只读验证:QC_ASM_INSP 表区 → 检验类型(物理列 + yj_field + 次序 + 注明)
SET NOCOUNT ON;

PRINT N'[1] 物理列(表区 应为 NULL、检验类型 应存在)';
SELECT COL_LENGTH(N'dbo.qc_asm_insp_detail', N'表区') AS 表区列长,
       COL_LENGTH(N'dbo.qc_asm_insp_detail', N'检验类型') AS 检验类型列长;

PRINT N'[2] yj_field(QC_ASM_INSP detail 可见列,按 seq)';
SELECT seq, col_name, label, data_type, place, visible, hidden, editable, ISNULL(alias,N'') AS alias
FROM yj_field WHERE panel_code = N'QC_ASM_INSP' AND place LIKE N'%detail%'
ORDER BY seq, id;

PRINT N'[3] 其它面板的 表区(应原样保留)';
SELECT panel_code, COUNT(*) AS n FROM yj_field WHERE col_name = N'表区' GROUP BY panel_code ORDER BY panel_code;

PRINT N'[4] 数据守恒 + 值分布';
SELECT COUNT(*) AS 总行数, SUM(CASE WHEN 检验类型 IS NOT NULL THEN 1 ELSE 0 END) AS 有类型值
FROM dbo.qc_asm_insp_detail;
SELECT ISNULL(检验类型, N'(null)') AS 检验类型, COUNT(*) AS 行数
FROM dbo.qc_asm_insp_detail GROUP BY 检验类型 ORDER BY 检验类型;

PRINT N'[5] 列级注明';
SELECT COL_NAME(ep.major_id, ep.minor_id) AS 列名, CAST(ep.value AS nvarchar(400)) AS 注明
FROM sys.extended_properties ep
WHERE ep.major_id = OBJECT_ID(N'dbo.qc_asm_insp_detail') AND ep.name = N'MS_Description'
  AND COL_NAME(ep.major_id, ep.minor_id) = N'检验类型';

PRINT N'[6] 迁移登记(yj_schema_log)';
SELECT script_name, LEFT(content_hash, 12) AS hash12, applied_at
FROM yj_schema_log WHERE script_name LIKE N'%asm-insp-type-rename%';

PRINT N'[7] 检验类型 译名(应 10 语言)';
SELECT locale, text FROM yj_translation WHERE scope = N'field' AND ref_key = N'检验类型' ORDER BY locale;
