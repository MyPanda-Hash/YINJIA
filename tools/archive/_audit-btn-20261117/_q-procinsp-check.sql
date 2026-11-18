SET NOCOUNT ON;
-- 逐条照抄 migrate-qc-proc-insp-batch-table-20261111.sql 第 7 节自检,输出每条的通过/失败
SELECT '7.1 detail.内部批次 列' AS chk, CASE WHEN COL_LENGTH('dbo.qc_proc_insp_detail', N'内部批次') IS NULL THEN 'FAIL' ELSE 'ok' END AS r
UNION ALL SELECT '7.1 head.内部批次清单 列', CASE WHEN COL_LENGTH('dbo.qc_proc_insp_head', N'内部批次清单') IS NULL THEN 'FAIL' ELSE 'ok' END
UNION ALL SELECT '7.1 head.表单审核人 列', CASE WHEN COL_LENGTH('dbo.qc_proc_insp_head', N'表单审核人') IS NULL THEN 'FAIL' ELSE 'ok' END
UNION ALL SELECT '7.3 yj_field 内部批次 行数=1', CASE WHEN (SELECT COUNT(*) FROM yj_field WHERE panel_code=N'QC_PROC_INSP' AND col_name=N'内部批次')=1 THEN 'ok' ELSE 'FAIL(' + CAST((SELECT COUNT(*) FROM yj_field WHERE panel_code=N'QC_PROC_INSP' AND col_name=N'内部批次') AS varchar) + ')' END
UNION ALL SELECT '7.3 yj_field 内部批次 属性', CASE WHEN EXISTS (SELECT 1 FROM yj_field WHERE panel_code=N'QC_PROC_INSP' AND col_name=N'内部批次' AND place LIKE N'%detail%' AND hidden=0 AND visible=1 AND editable=1 AND required=0 AND ISNULL(seq,0)>0) THEN 'ok' ELSE 'FAIL' END
UNION ALL SELECT '7.3 yj_field 内部批次清单 行数=1', CASE WHEN (SELECT COUNT(*) FROM yj_field WHERE panel_code=N'QC_PROC_INSP' AND col_name=N'内部批次清单')=1 THEN 'ok' ELSE 'FAIL(' + CAST((SELECT COUNT(*) FROM yj_field WHERE panel_code=N'QC_PROC_INSP' AND col_name=N'内部批次清单') AS varchar) + ')' END
UNION ALL SELECT '7.3 yj_field 内部批次清单 属性', CASE WHEN EXISTS (SELECT 1 FROM yj_field WHERE panel_code=N'QC_PROC_INSP' AND col_name=N'内部批次清单' AND place=N'header' AND hidden=1 AND visible=0 AND editable=1) THEN 'ok' ELSE 'FAIL' END
UNION ALL SELECT '7.3 yj_field 表单审核人 行数=1', CASE WHEN (SELECT COUNT(*) FROM yj_field WHERE panel_code=N'QC_PROC_INSP' AND col_name=N'表单审核人')=1 THEN 'ok' ELSE 'FAIL(' + CAST((SELECT COUNT(*) FROM yj_field WHERE panel_code=N'QC_PROC_INSP' AND col_name=N'表单审核人') AS varchar) + ')' END
UNION ALL SELECT '7.3 yj_field 表单审核人 属性', CASE WHEN EXISTS (SELECT 1 FROM yj_field WHERE panel_code=N'QC_PROC_INSP' AND col_name=N'表单审核人' AND place=N'header' AND hidden=1 AND visible=0 AND editable=1) THEN 'ok' ELSE 'FAIL' END
UNION ALL SELECT '7.4 明细 seq 撞号', CASE WHEN EXISTS (SELECT 1 FROM yj_field WHERE panel_code=N'QC_PROC_INSP' AND place LIKE N'%detail%' GROUP BY seq HAVING COUNT(*)>1) THEN 'FAIL' ELSE 'ok' END
UNION ALL SELECT '7.5 总结论 下拉', CASE WHEN EXISTS (SELECT 1 FROM yj_field WHERE panel_code=N'QC_PROC_INSP' AND col_name=N'总结论' AND data_type=N'下拉框' AND dict_sql LIKE N'%合格%' AND dict_sql LIKE N'%不合格%') THEN 'ok' ELSE 'FAIL' END
UNION ALL SELECT '7.5 处理方式 下拉', CASE WHEN EXISTS (SELECT 1 FROM yj_field WHERE panel_code=N'QC_PROC_INSP' AND col_name=N'处理方式' AND data_type=N'下拉框' AND dict_sql LIKE N'%允收%' AND dict_sql LIKE N'%报废%' AND hidden=1) THEN 'ok' ELSE 'FAIL' END
UNION ALL SELECT '7.6 译名 内部批次(en)', CASE WHEN EXISTS (SELECT 1 FROM yj_translation WHERE scope=N'field' AND ref_key=N'内部批次' AND locale='en') THEN 'ok' ELSE 'FAIL' END
UNION ALL SELECT '7.6 译名 表单审核人(en)', CASE WHEN EXISTS (SELECT 1 FROM yj_translation WHERE scope=N'field' AND ref_key=N'表单审核人' AND locale='en') THEN 'ok' ELSE 'FAIL' END
UNION ALL SELECT '7.6 译名 检测周期(en)', CASE WHEN EXISTS (SELECT 1 FROM yj_translation WHERE scope=N'field' AND ref_key=N'检测周期' AND locale='en') THEN 'ok' ELSE 'FAIL' END
UNION ALL SELECT '7.7 面板已改名 出货检验表观', CASE WHEN EXISTS (SELECT 1 FROM yj_panel WHERE panel_code=N'QC_ASM_INSP' AND panel_name=N'出货检验表观') THEN 'ok' ELSE 'FAIL' END
UNION ALL SELECT '7.7 旧名残留', CASE WHEN EXISTS (SELECT 1 FROM yj_panel WHERE panel_name=N'组装成品检验单') THEN 'FAIL' ELSE 'ok' END
UNION ALL SELECT '7.9 检测周期 进 yj_field(不该有)', CASE WHEN EXISTS (SELECT 1 FROM yj_field WHERE panel_code=N'QC_PROC_INSP' AND col_name=N'检测周期') THEN 'FAIL' ELSE 'ok' END
ORDER BY chk;
