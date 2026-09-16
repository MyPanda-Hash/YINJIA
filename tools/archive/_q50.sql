SET NOCOUNT ON;
SELECT name, is_nullable FROM sys.columns WHERE object_id=OBJECT_ID('dbo.yj_panel') AND is_nullable=0 ORDER BY column_id;
