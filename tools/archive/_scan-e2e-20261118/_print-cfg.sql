SET NOCOUNT ON;
SELECT 设置键, 设置值 FROM yj_app_setting WHERE 设置键 LIKE N'print.%' ORDER BY 设置键;
