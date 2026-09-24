SET NOCOUNT ON;
PRINT '== 三表全部列(找单位/数量列名) ==';
SELECT OBJECT_NAME(c.object_id) AS tbl, c.name FROM sys.columns c
 WHERE c.object_id IN (OBJECT_ID('qc_catalog_detail'), OBJECT_ID('qc_insp_rec_detail'), OBJECT_ID('qc_tc_in'))
 ORDER BY 1, c.column_id;
GO
