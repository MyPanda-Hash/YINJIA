-- 只读探针:未提交迁移的库侧取证(QC_ASM_INSP 合格数量改名 / yj_schema_log / 译名 / config)
-- 用法(在 tools 目录):java -cp lib\mssql-jdbc.jar SqlRunner.java "<jdbcUrl>" yinjia env archive\_q-db-verify-qc-20261017.sql
SET NOCOUNT ON;

SELECT DB_NAME() AS db_name;

SELECT N'[1] yj_schema_log:10 条新迁移' AS q, script_name, LEFT(content_hash, 16) AS hash16,
       CONVERT(varchar(19), applied_at, 120) AS applied_at
FROM dbo.yj_schema_log
WHERE script_name IN (
  N'migrate-asm-insp-fixed-groups-20261016.sql',
  N'migrate-asm-insp-fixed-items-20261016.sql',
  N'migrate-asm-insp-passqty-in-20261017.sql',
  N'migrate-asm-insp-passqty-rename-20261017.sql',
  N'migrate-asm-insp-report-fields-20261016.sql',
  N'migrate-asm-insp-type-rename-20261017.sql',
  N'migrate-asm-insp-verdict-rename-20261016.sql',
  N'migrate-qc-proc-insp-audit-trail-20261017.sql',
  N'migrate-qc-proc-insp-func-result-20261017.sql',
  N'migrate-qc-proc-insp-report-vertical-20261017.sql')
ORDER BY script_name;

SELECT N'[2] yj_field QC_ASM_INSP 表头字段' AS q, id, seq, col_name, label, data_type, place,
       visible, hidden, editable, required
FROM yj_field WHERE panel_code = N'QC_ASM_INSP' AND place LIKE N'%header%' ORDER BY seq, id;

SELECT N'[3] yj_field 全库旧标签「合格数量（入库）」残留' AS q, id, panel_code, col_name, label, place, seq
FROM yj_field WHERE col_name LIKE N'%合格数量（入库）%' OR label LIKE N'%合格数量（入库）%'
ORDER BY panel_code, seq;

SELECT N'[4] yj_field 全库「合格数量」登记' AS q, id, panel_code, col_name, label, place, seq, required, visible, hidden
FROM yj_field WHERE col_name = N'合格数量' OR label = N'合格数量' ORDER BY panel_code, seq;

SELECT N'[5] yj_translation 新旧 key' AS q, scope, ref_key, locale, text, source
FROM yj_translation WHERE ref_key IN (N'合格数量', N'合格数量（入库）') ORDER BY ref_key, locale;

SELECT N'[6] yj_panel.config QC_ASM_INSP' AS q, panel_code, config FROM yj_panel WHERE panel_code = N'QC_ASM_INSP';

SELECT N'[7] qc_asm_insp_head 含「合格」列' AS q, c.column_id, c.name AS col_name, t.name AS type_name,
       c.precision, c.scale, c.is_nullable
FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID(N'dbo.qc_asm_insp_head') AND c.name LIKE N'%合格%' ORDER BY c.column_id;
