SELECT name, type_desc, CONVERT(varchar(19),modify_date,120) AS modified
FROM sys.objects WHERE type IN ('P','FN','IF','TF','V') AND (OBJECT_DEFINITION(object_id) LIKE '%ja%' AND OBJECT_DEFINITION(object_id) LIKE '%plang%')
ORDER BY type_desc, name;
