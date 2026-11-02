SET NOCOUNT ON;
SELECT t.name, STUFF((SELECT ', '+c.name FROM sys.columns c WHERE c.object_id=t.object_id ORDER BY c.column_id FOR XML PATH(''),TYPE).value('.','nvarchar(max)'),1,2,'') cols FROM sys.tables t WHERE t.name='yj_user';
GO
SELECT TOP 20 * FROM yj_user WHERE 姓名 LIKE N'%冯敏%' OR 用户名 LIKE N'%冯敏%' OR 姓名 LIKE N'%admin%';
