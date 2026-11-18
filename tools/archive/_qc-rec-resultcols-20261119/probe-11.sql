SET NOCOUNT ON;
SELECT script_name, LEFT(content_hash,10) AS sha10, applied_at FROM yj_schema_log WHERE script_name = N'migrate-qc-insp-rec-resultcols-20261119.sql';
SELECT (SELECT COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.qc_insp_rec_detail') AND name LIKE N'结果%') AS 结果物理列,
       (SELECT COUNT(*) FROM yj_field WHERE panel_code=N'QC_INSP_REC' AND place=N'detail' AND label LIKE N'结果%') AS 结果字段;
