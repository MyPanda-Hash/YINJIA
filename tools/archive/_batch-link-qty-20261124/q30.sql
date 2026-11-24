SET NOCOUNT ON;
SELECT c.name, t.name AS 类型 FROM sys.columns c JOIN sys.types t ON t.user_type_id=c.user_type_id
 WHERE c.object_id=OBJECT_ID('form_flow_link') ORDER BY c.column_id;
