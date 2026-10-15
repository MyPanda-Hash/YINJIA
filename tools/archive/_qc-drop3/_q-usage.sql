SET NOCOUNT ON;
PRINT '=== 1 三张面板元数据 ===';
SELECT p.panel_code, p.panel_name, p.category, p.mode, p.line_table, p.head_table, p.module_group, p.prefix, p.date_col,
       (SELECT COUNT(*) FROM yj_field f WHERE f.panel_code=p.panel_code) AS fld,
       (SELECT COUNT(*) FROM yj_role_panel r WHERE r.panel_code=p.panel_code) AS grants,
       (SELECT COUNT(*) FROM yj_doc_status d WHERE d.panel_code=p.panel_code) AS doc_status
FROM yj_panel p WHERE p.panel_code IN ('QC_MOLD_INSP','QC_CUT_INSP','QC_FIN_SPEC') ORDER BY p.panel_code;
GO
PRINT '=== 2 业务表行数 ===';
SELECT N'qc_mold_insp' AS obj, COUNT(*) AS n FROM dbo.qc_mold_insp
UNION ALL SELECT N'qc_mold_insp_detail', COUNT(*) FROM dbo.qc_mold_insp_detail
UNION ALL SELECT N'qc_cut_insp', COUNT(*) FROM dbo.qc_cut_insp
UNION ALL SELECT N'qc_cut_insp_detail', COUNT(*) FROM dbo.qc_cut_insp_detail
UNION ALL SELECT N'qc_fin_spec_head', COUNT(*) FROM dbo.qc_fin_spec_head
UNION ALL SELECT N'qc_fin_spec_detail', COUNT(*) FROM dbo.qc_fin_spec_detail;
GO
PRINT '=== 2b 头表台账 ===';
SELECT N'qc_mold_insp' AS t, MIN(asp_time1) AS tmin, MAX(asp_time1) AS tmax, COUNT(*) AS n FROM dbo.qc_mold_insp
UNION ALL SELECT N'qc_cut_insp', MIN(asp_time1), MAX(asp_time1), COUNT(*) FROM dbo.qc_cut_insp
UNION ALL SELECT N'qc_fin_spec_head', MIN(asp_time1), MAX(asp_time1), COUNT(*) FROM dbo.qc_fin_spec_head;
GO
PRINT '=== 3 留痕/附件/审批/批次 ===';
SELECT ISNULL(panel_name,N'(null)') AS panel_name, action_name, COUNT(*) AS n, MIN(created_at) AS tmin, MAX(created_at) AS tmax
FROM yj_usage_log WHERE panel_name IN (N'成型检验单',N'切炭检验单',N'成品检验规范') GROUP BY panel_name, action_name;
GO
SELECT N'yj_usage_log_total' AS k, COUNT(*) AS n FROM yj_usage_log
UNION ALL SELECT N'attachment', COUNT(*) FROM yj_attachment WHERE panel_code IN ('QC_MOLD_INSP','QC_CUT_INSP','QC_FIN_SPEC')
UNION ALL SELECT N'form_approval', COUNT(*) FROM yj_form_approval WHERE panel_code IN ('QC_MOLD_INSP','QC_CUT_INSP','QC_FIN_SPEC')
UNION ALL SELECT N'report_column_settings', COUNT(*) FROM report_column_settings WHERE panel_code IN ('QC_MOLD_INSP','QC_CUT_INSP','QC_FIN_SPEC')
UNION ALL SELECT N'doc_batch_src', COUNT(*) FROM yj_doc_batch WHERE source_panel_code IN ('QC_MOLD_INSP','QC_CUT_INSP','QC_FIN_SPEC')
UNION ALL SELECT N'doc_batch_tgt', COUNT(*) FROM yj_doc_batch WHERE target_panel_code IN ('QC_MOLD_INSP','QC_CUT_INSP','QC_FIN_SPEC');
GO
PRINT '=== 4 别的面板参照 ===';
SELECT f.panel_code AS host, f.label, f.ref_panel FROM yj_field f
WHERE f.ref_panel IN ('QC_MOLD_INSP','QC_CUT_INSP','QC_FIN_SPEC') ORDER BY 1,2;
GO
PRINT '=== 5 单号台账(按类别) ===';
SELECT lb, COUNT(*) AS n, MIN(asp_time1) AS tmin, MAX(asp_time1) AS tmax FROM s_allno
WHERE lb IN (N'CXJY',N'QXJY',N'CPJY') GROUP BY lb;
GO
PRINT '=== 6 DB 侧依赖 ===';
SELECT DISTINCT OBJECT_NAME(d.referencing_id) AS referrer, d.referenced_entity_name AS referenced
FROM sys.sql_expression_dependencies d
WHERE d.referenced_entity_name IN ('qc_mold_insp','qc_mold_insp_detail','qc_cut_insp','qc_cut_insp_detail','qc_fin_spec_head','qc_fin_spec_detail');
GO
SELECT o.name, o.type_desc FROM sys.objects o WHERE o.type IN ('V','P','FN','IF','TF')
  AND EXISTS (SELECT 1 FROM sys.sql_modules m WHERE m.object_id=o.object_id AND (m.definition LIKE '%qc_mold_insp%' OR m.definition LIKE '%qc_cut_insp%' OR m.definition LIKE '%qc_fin_spec%'))
ORDER BY o.name;
GO
PRINT '=== 7 相关对象 ===';
SELECT o.name, o.type_desc, o.modify_date FROM sys.objects o
WHERE o.name LIKE '%mold_insp%' OR o.name LIKE '%cut_insp%' OR o.name LIKE '%fin_spec%' ORDER BY o.name;
GO
