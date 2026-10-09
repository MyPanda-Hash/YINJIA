SET NOCOUNT ON;
SELECT script_name AS 脚本, applied_at AS 执行时间 FROM yj_schema_log WHERE script_name LIKE N'%fourdoc%' ORDER BY script_name;
GO