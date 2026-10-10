-- q-07-after.sql — 探针:两账套改后复核(应为 4 行 参照/INV)
SELECT place, seq, col_name, data_type, ref_panel, ref_field, display_field, required, hidden, visible
FROM yj_field WHERE panel_code = N'QC_INSP_REC' AND col_name IN (N'物料名称', N'物料编码')
ORDER BY place, seq, id;

PRINT N'=== 计数(应 4/4)==='; 
SELECT
  (SELECT COUNT(*) FROM yj_field WHERE panel_code=N'QC_INSP_REC' AND col_name IN (N'物料名称',N'物料编码')) AS 两列行数,
  (SELECT COUNT(*) FROM yj_field WHERE panel_code=N'QC_INSP_REC' AND col_name IN (N'物料名称',N'物料编码')
     AND data_type=N'参照' AND ref_panel=N'INV') AS 参照INV行数,
  (SELECT COUNT(*) FROM yj_field WHERE panel_code=N'QC_INSP_REC' AND data_type=N'参照'
     AND col_name NOT IN (N'物料名称',N'物料编码')) AS 其他参照行数;
