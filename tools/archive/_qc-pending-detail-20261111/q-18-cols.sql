SET NOCOUNT ON;
SELECT COUNT(*) AS view_columns FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.v_qc_insp_rec_detail');
SELECT COUNT(*) AS views_total FROM sys.views WHERE name LIKE N'v[_!]%' ESCAPE N'!';
SELECT COUNT(*) AS all_views FROM sys.views;
