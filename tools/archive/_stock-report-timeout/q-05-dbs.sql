SET NOCOUNT ON;
GO
SELECT name, create_date, state_desc, compatibility_level FROM sys.databases ORDER BY name;
GO
