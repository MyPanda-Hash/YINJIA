SET NOCOUNT ON;
SELECT name, description = CAST(ep.value AS nvarchar(200)) FROM sys.columns c
  LEFT JOIN sys.extended_properties ep ON ep.major_id=c.object_id AND ep.minor_id=c.column_id
 WHERE c.object_id=OBJECT_ID('inh') ORDER BY c.column_id;
