SET NOCOUNT ON;
SELECT o.type_desc, o.name AS obj,
       SUBSTRING(m.definition, PATINDEX('%' + N'单据编号' + '%', m.definition) - 60, 220) AS ctx
FROM sys.sql_modules m JOIN sys.objects o ON o.object_id = m.object_id
WHERE m.definition LIKE N'%LEFT(%单据编号%' OR m.definition LIKE N'%SUBSTRING(%单据编号%'
   OR m.definition LIKE N'%单据编号%LIKE%' OR m.definition LIKE N'%LIKE%单据编号%'
ORDER BY o.name;
