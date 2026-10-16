SET NOCOUNT ON;
SELECT d.name, d.create_date, d.compatibility_level,
       mf.type_desc, mf.physical_name, CAST(mf.size * 8.0 / 1024 AS decimal(10,1)) AS size_mb
FROM sys.databases d
JOIN sys.master_files mf ON mf.database_id = d.database_id
WHERE d.database_id > 4
ORDER BY d.name, mf.file_id;
