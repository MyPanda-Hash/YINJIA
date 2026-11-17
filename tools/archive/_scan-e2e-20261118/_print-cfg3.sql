SET NOCOUNT ON;
SELECT setting_key, setting_value, ISNULL(remark,N'') AS remark FROM yj_app_setting
WHERE setting_key LIKE N'print.%' ORDER BY setting_key;
