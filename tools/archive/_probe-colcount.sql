SELECT OBJECT_NAME(object_id) AS t, COUNT(*) AS cols FROM sys.columns WHERE object_id IN (OBJECT_ID('dbo.qc_insp'), OBJECT_ID('dbo.qc_insp_detail')) GROUP BY object_id;
