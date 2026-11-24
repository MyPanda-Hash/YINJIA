SELECT '7.1 列存在' AS item,
  CASE WHEN COL_LENGTH('dbo.qc_proc_insp_detail','内部批次') IS NULL THEN 'MISS' ELSE 'ok' END AS v1,
  CASE WHEN COL_LENGTH('dbo.qc_proc_insp_head','内部批次清单') IS NULL THEN 'MISS' ELSE 'ok' END AS v2,
  CASE WHEN COL_LENGTH('dbo.qc_proc_insp_head','表单审核人') IS NULL THEN 'MISS' ELSE 'ok' END AS v3;

SELECT '7.2 列注明' AS item,
  (SELECT COUNT(*) FROM sys.extended_properties WHERE major_id=OBJECT_ID('dbo.qc_proc_insp_detail') AND minor_id=COLUMNPROPERTY(OBJECT_ID('dbo.qc_proc_insp_detail'),'内部批次','ColumnId') AND name='MS_Description') AS c_inner_batch,
  (SELECT COUNT(*) FROM sys.extended_properties WHERE major_id=OBJECT_ID('dbo.qc_proc_insp_head') AND minor_id=COLUMNPROPERTY(OBJECT_ID('dbo.qc_proc_insp_head'),'内部批次清单','ColumnId') AND name='MS_Description') AS c_batch_list,
  (SELECT COUNT(*) FROM sys.extended_properties WHERE major_id=OBJECT_ID('dbo.qc_proc_insp_head') AND minor_id=COLUMNPROPERTY(OBJECT_ID('dbo.qc_proc_insp_head'),'表单审核人','ColumnId') AND name='MS_Description') AS c_auditor;

SELECT panel_code, col_name, place, hidden, visible, editable, required, seq, data_type, LEFT(ISNULL(dict_sql,''),60) AS dict
FROM yj_field WHERE panel_code='QC_PROC_INSP' AND col_name IN ('内部批次','内部批次清单','表单审核人')
ORDER BY col_name;

SELECT seq, COUNT(*) AS n, STRING_AGG(col_name, ',') WITHIN GROUP (ORDER BY id) AS cols
FROM yj_field WHERE panel_code='QC_PROC_INSP' AND place LIKE '%detail%'
GROUP BY seq HAVING COUNT(*) > 1;

SELECT col_name, data_type, hidden, LEFT(ISNULL(dict_sql,''),80) AS dict
FROM yj_field WHERE panel_code='QC_PROC_INSP' AND col_name IN ('总结论','处理方式');

SELECT ref_key, COUNT(*) AS locales,
  SUM(CASE WHEN locale='en' THEN 1 ELSE 0 END) AS has_en
FROM yj_translation
WHERE (scope='field' AND ref_key IN ('内部批次','内部批次清单','表单审核人','检测周期'))
   OR (scope='panel' AND ref_key IN ('出货检验表观','组装成品检验单'))
GROUP BY ref_key;

SELECT panel_code, panel_name, line_table, head_table, prefix FROM yj_panel WHERE panel_code IN ('QC_PROC_INSP','QC_ASM_INSP');

SELECT COUNT(*) AS old_name_panels FROM yj_panel WHERE panel_name='组装成品检验单';

SELECT COUNT(*) AS derived_col_in_meta FROM yj_field WHERE panel_code='QC_PROC_INSP' AND col_name='检测周期';
