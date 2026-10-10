SET NOCOUNT ON;
PRINT N'库 = ' + DB_NAME();
PRINT N'-- ① 三个工序检验单面板是否在册';
SELECT panel_code, panel_name, ISNULL(panel_name_en, N'(NULL)') AS en, module_group,
       line_table, head_table, prefix, category
  FROM yj_panel WHERE panel_code IN (N'QC_MOLD_INSP', N'QC_CUT_INSP', N'QC_ASM_INSP')
 ORDER BY panel_code;
PRINT N'-- ② 六张物理表是否存在 / 各多少列';
SELECT t.name AS 表名, (SELECT COUNT(*) FROM sys.columns c WHERE c.object_id = t.object_id) AS 列数,
       (SELECT COUNT(*) FROM sys.extended_properties ep WHERE ep.major_id = t.object_id AND ep.minor_id = 0 AND ep.name = N'MS_Description') AS 有中文注明
  FROM sys.tables t
 WHERE t.name IN (N'qc_mold_insp_head', N'qc_mold_insp_detail', N'qc_cut_insp_head', N'qc_cut_insp_detail',
                  N'qc_asm_insp_head', N'qc_asm_insp_detail')
 ORDER BY t.name;
PRINT N'-- ③ 三个面板的字段登记数 + 面板名译名';
SELECT panel_code AS 面板, COUNT(*) AS 字段行数 FROM yj_field
 WHERE panel_code IN (N'QC_MOLD_INSP', N'QC_CUT_INSP', N'QC_ASM_INSP') GROUP BY panel_code ORDER BY panel_code;
SELECT ref_key AS 面板名, locale, text FROM yj_translation
 WHERE scope = N'panel' AND ref_key IN (N'成型检验单', N'切炭检验单', N'组装成品检验单')
 ORDER BY ref_key, locale;
PRINT N'-- ④ 角色授权(谁能看见)';
SELECT panel_code AS 面板, COUNT(*) AS 授权行数 FROM yj_role_panel
 WHERE panel_code IN (N'QC_MOLD_INSP', N'QC_CUT_INSP', N'QC_ASM_INSP') GROUP BY panel_code;
PRINT N'-- ⑤ 迁移登记';
SELECT script_name, applied_at FROM yj_schema_log WHERE script_name = N'migrate-qc-process-insp.sql';
