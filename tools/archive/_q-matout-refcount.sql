SET NOCOUNT ON;
SELECT COUNT(*) AS 参照字段数 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND data_type=N'参照';
GO
