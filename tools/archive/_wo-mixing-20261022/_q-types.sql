SET NOCOUNT ON;
SELECT data_type, COUNT(*) n FROM dbo.yj_field GROUP BY data_type ORDER BY n DESC;
SELECT place, COUNT(*) n FROM dbo.yj_field GROUP BY place ORDER BY n DESC;
