-- 只读验证:QC_ASM_INSP 表头「合格数量（入库）」已就位(物理列 + 字段登记 + 必填 + 译名 + 注明)
SET NOCOUNT ON;

PRINT N'[1] 物理列';
SELECT c.name AS 列名, t.name AS 类型, c.precision AS 精度, c.scale AS 小数位, c.is_nullable AS 可空
FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID(N'dbo.qc_asm_insp_head') AND c.name = N'合格数量（入库）';

PRINT N'[2] yj_field 登记';
SELECT place, seq, col_name, label, data_type, visible, hidden, editable, required
FROM yj_field WHERE panel_code = N'QC_ASM_INSP' AND col_name = N'合格数量（入库）';

PRINT N'[3] 表头字段次序(该列前后各一)';
SELECT seq, col_name, data_type, required FROM yj_field
WHERE panel_code = N'QC_ASM_INSP' AND place LIKE N'%header%' AND seq BETWEEN 110 AND 150 ORDER BY seq, id;

PRINT N'[4] 译名';
SELECT locale, text FROM yj_translation WHERE scope = N'field' AND ref_key = N'合格数量（入库）' ORDER BY locale;

PRINT N'[5] 列级注明';
SELECT COL_NAME(ep.major_id, ep.minor_id) AS 列名, CAST(ep.value AS nvarchar(400)) AS 注明
FROM sys.extended_properties ep
WHERE ep.major_id = OBJECT_ID(N'dbo.qc_asm_insp_head') AND ep.name = N'MS_Description'
  AND COL_NAME(ep.major_id, ep.minor_id) = N'合格数量（入库）';

PRINT N'[6] 迁移登记 + 数据守恒';
SELECT script_name, LEFT(content_hash, 12) AS hash12, applied_at FROM yj_schema_log
WHERE script_name LIKE N'%asm-insp-passqty-in%';
SELECT COUNT(*) AS 头表行数, SUM(CASE WHEN [合格数量（入库）] IS NOT NULL THEN 1 ELSE 0 END) AS 已填行数
FROM dbo.qc_asm_insp_head;
