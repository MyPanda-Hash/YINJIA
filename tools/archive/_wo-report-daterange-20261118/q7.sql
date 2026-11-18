SET NOCOUNT ON;
SELECT TOP 10 sc_date, CONVERT(varchar(19), sc_date, 120) AS dt120 FROM scjl WHERE sc_date IS NOT NULL ORDER BY id DESC;
GO
SELECT COUNT(*) AS with_time FROM scjl WHERE sc_date IS NOT NULL AND CAST(sc_date AS time) <> '00:00:00';
SELECT COUNT(*) AS total_nonnull FROM scjl WHERE sc_date IS NOT NULL;
GO
