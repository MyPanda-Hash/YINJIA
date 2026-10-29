SET NOCOUNT ON;
SELECT name FROM sys.tables WHERE name LIKE '%mold_insp%' OR name LIKE '%qc_%insp%' ORDER BY name;
