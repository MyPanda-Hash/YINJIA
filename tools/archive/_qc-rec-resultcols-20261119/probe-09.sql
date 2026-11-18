SET NOCOUNT ON;
SELECT (SELECT COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.qc_insp_rec')) AS head_cols,
       (SELECT COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.qc_insp_rec_detail')) AS detail_cols;
