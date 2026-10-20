SET NOCOUNT ON;
SELECT c.name FROM sys.columns c WHERE c.object_id = OBJECT_ID('bs_route') ORDER BY c.column_id;
SELECT * FROM bs_route WHERE 工艺路线编码 LIKE 'GY-2026-10-%' ORDER BY 工艺路线编码, id;
