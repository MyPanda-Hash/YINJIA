SELECT name, compatibility_level FROM sys.databases WHERE name IN ('HSDZ_MES','HSDZ_MES_TEST');
GO
SELECT STRING_AGG(name, N',') FROM sys.tables;