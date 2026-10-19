SET NOCOUNT ON;
SELECT c.name + '=' + ISNULL(CAST(
  (SELECT TOP 1 CASE WHEN c.name='id' THEN CAST(id AS nvarchar(20)) ELSE NULL END FROM sl_recv WHERE id=570)
, 'x') FROM sys.columns c WHERE c.object_id=OBJECT_ID('sl_recv');
