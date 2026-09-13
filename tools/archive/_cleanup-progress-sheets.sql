USE HSDZ_MES;
SET NOCOUNT ON;
DELETE FROM rd_progress_detail WHERE [说明] LIKE 'DSPROBE-%';
SELECT COUNT(*) AS probe_rows_left FROM rd_progress_detail WHERE [说明] LIKE 'DSPROBE-%';
