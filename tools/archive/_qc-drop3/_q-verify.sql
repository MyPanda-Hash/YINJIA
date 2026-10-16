SET NOCOUNT ON;
DECLARE @c TABLE(c varchar(40)); INSERT INTO @c VALUES ('QC_MOLD_INSP'),('QC_CUT_INSP'),('QC_FIN_SPEC');
SELECT N'yj_panel 残留' AS k, COUNT(*) AS v FROM yj_panel WHERE panel_code IN (SELECT c FROM @c)
UNION ALL SELECT N'yj_field 残留', COUNT(*) FROM yj_field WHERE panel_code IN (SELECT c FROM @c)
UNION ALL SELECT N'yj_role_panel 残留', COUNT(*) FROM yj_role_panel WHERE panel_code IN (SELECT c FROM @c)
UNION ALL SELECT N'yj_doc_status 残留', COUNT(*) FROM yj_doc_status WHERE panel_code IN (SELECT c FROM @c)
UNION ALL SELECT N'form_flow_link 残留', COUNT(*) FROM form_flow_link WHERE source_panel_code IN (SELECT c FROM @c) OR target_panel_code IN (SELECT c FROM @c)
UNION ALL SELECT N'yj_form_approval 残留', COUNT(*) FROM yj_form_approval WHERE panel_code IN (SELECT c FROM @c)
UNION ALL SELECT N'物理对象残留', COUNT(*) FROM sys.objects WHERE name IN ('qc_mold_insp_head','qc_mold_insp_detail','qc_cut_insp_head','qc_cut_insp_detail','qc_fin_spec_head','qc_fin_spec_detail')
UNION ALL SELECT N'面板总数', COUNT(*) FROM yj_panel
UNION ALL SELECT N'字段总数', COUNT(*) FROM yj_field
UNION ALL SELECT N'制程品质保留三张', COUNT(*) FROM yj_panel WHERE panel_code IN ('QC_FIRST_INSP','QC_PROC_INSP','QC_ASM_INSP')
UNION ALL SELECT N'质量单据保留七张', COUNT(*) FROM yj_panel WHERE panel_code IN ('QC_BHG','QC_BHC','QC_BHZ','QC_JJF','QC_SCP','QC_LYB','QC_SCY')
UNION ALL SELECT N'悬空 ref_panel', COUNT(*) FROM yj_field f WHERE f.ref_panel IS NOT NULL AND f.ref_panel<>N'' AND NOT EXISTS(SELECT 1 FROM yj_panel p WHERE p.panel_code=f.ref_panel)
UNION ALL SELECT N'指向不存在表/视图的面板', COUNT(*) FROM yj_panel p WHERE (p.line_table IS NOT NULL AND p.line_table<>N'' AND OBJECT_ID(p.line_table) IS NULL) OR (p.head_table IS NOT NULL AND p.head_table<>N'' AND OBJECT_ID(p.head_table) IS NULL)
UNION ALL SELECT N'对象仍引用被删表', COUNT(*) FROM sys.sql_modules m WHERE m.definition LIKE N'%qc_mold_insp%' OR m.definition LIKE N'%qc_cut_insp%' OR m.definition LIKE N'%qc_fin_spec%';
SELECT N'schema_log' AS k, script_name, content_hash, applied_at FROM yj_schema_log WHERE script_name LIKE '%mold-cut-finspec%';
