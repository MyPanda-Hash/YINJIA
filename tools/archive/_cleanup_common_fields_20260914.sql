USE HSDZ_MES;
SET NOCOUNT ON;
DELETE f FROM yj_field f JOIN yj_panel p ON p.panel_code = f.panel_code
WHERE p.module_group = N'研发管理' AND p.mode = 'doc'
  AND f.col_name IN (N'record_no', N'test_date', N'sample_name', N'sample_no', N'tester')
  AND f.panel_code NOT IN ('RD_FILTER_EFF','RD_ALKALINE','RD_MINERAL','RD_ANTIBACT','RD_SCALE','RD_RO_PROTECT','RD_SOAK','RD_DROP_PREC')
  AND (p.line_table IS NULL OR COL_LENGTH(p.line_table, f.col_name) IS NULL)
  AND (p.head_table IS NULL OR COL_LENGTH(p.head_table, f.col_name) IS NULL);
SELECT @@ROWCOUNT AS removed_phantom_fields;
