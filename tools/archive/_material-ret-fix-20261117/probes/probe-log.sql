SET NOCOUNT ON;
SELECT 'LOG|' + script + '|' + CONVERT(varchar(19), applied_at, 120) FROM dbo.yj_schema_log
 WHERE script IN (N'migrate-material-ret-wo-line-nodetail-20261117.sql', N'migrate-qc-proc-insp-batch-table-20261111.sql');
SELECT 'FIELD|' + panel_code + '|' + label + '|' + place FROM yj_field WHERE panel_code=N'MATERIAL_RET' AND label=N'工单行号';