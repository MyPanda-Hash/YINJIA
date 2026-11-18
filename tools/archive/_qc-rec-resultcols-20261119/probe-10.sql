SET NOCOUNT ON;
SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'yj_schema_log';
SELECT * FROM yj_schema_log WHERE script_name IN (N'migrate-qc-insp-rec-resultcols-20261119.sql', N'migrate-qc-proc-insp-batch-table-20261111.sql');
