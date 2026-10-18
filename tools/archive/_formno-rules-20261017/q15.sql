SET NOCOUNT ON;
PRINT '== 含 单据编号 且 含 LEFT(/SUBSTRING(/PATINDEX( 的对象 ==';
SELECT o.type_desc, o.name
FROM sys.sql_modules m JOIN sys.objects o ON o.object_id = m.object_id
WHERE m.definition LIKE N'%单据编号%'
  AND (m.definition LIKE N'%LEFT(%' OR m.definition LIKE N'%SUBSTRING(%' OR m.definition LIKE N'%PATINDEX(%'
       OR m.definition LIKE N'%STUFF(%' OR m.definition LIKE N'%CHARINDEX(%');
PRINT '== 含 单据编号 且 含 LIKE 的对象 ==';
SELECT o.type_desc, o.name
FROM sys.sql_modules m JOIN sys.objects o ON o.object_id = m.object_id
WHERE m.definition LIKE N'%单据编号%' AND m.definition LIKE N'%LIKE%';
PRINT '== 引用 单据编号 的对象总数 ==';
SELECT COUNT(*) AS objs FROM sys.sql_modules m WHERE m.definition LIKE N'%单据编号%';
