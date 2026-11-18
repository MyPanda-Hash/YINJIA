SET NOCOUNT ON;
SELECT data_type, COUNT(*) AS n FROM yj_field GROUP BY data_type ORDER BY n DESC;
SELECT TOP 5 panel_code, col_name, label, data_type FROM yj_field WHERE data_type LIKE N'%数%';
SELECT c.name, t.name, c.max_length FROM sys.columns c JOIN sys.types t ON c.user_type_id=t.user_type_id WHERE c.object_id=OBJECT_ID(N'dbo.qc_insp_rec') ORDER BY c.column_id;
