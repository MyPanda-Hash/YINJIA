SELECT name, type_desc, CONVERT(varchar(19),modify_date,120) AS modified
FROM sys.objects WHERE type IN ('P','TR','TA','FN','IF','TF') ORDER BY type_desc, name;
SELECT name FROM sys.databases ORDER BY name;
