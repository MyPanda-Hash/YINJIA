SET NOCOUNT ON;
-- 1. qc_insp(来料检验单)的列
SELECT c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('dbo.qc_insp') ORDER BY c.column_id;
