SET NOCOUNT ON;
SELECT t.name AS tbl, CAST(ep.value AS nvarchar(200)) AS ms_description
FROM sys.tables t
JOIN sys.extended_properties ep ON ep.major_id = t.object_id AND ep.minor_id = 0 AND ep.name = N'MS_Description'
WHERE CAST(ep.value AS nvarchar(200)) LIKE N'%禁用%'
ORDER BY t.name;
GO
