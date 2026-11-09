SET NOCOUNT ON;
SELECT setting_key, setting_value, remark FROM yj_app_setting WHERE setting_key LIKE '%ratio%' OR setting_key LIKE '%over%';
GO
SELECT TOP 5 setting_key, setting_value FROM yj_app_setting ORDER BY setting_key;
GO
