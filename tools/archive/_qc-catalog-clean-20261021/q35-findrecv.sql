SET NOCOUNT ON;
SELECT name FROM sys.tables WHERE name LIKE 'qc_recv%' OR name LIKE 'qc_receiv%' OR name LIKE '%recv%';
