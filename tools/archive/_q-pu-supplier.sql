SET NOCOUNT ON;
SELECT id, col_name, place, hidden, visible FROM yj_field WHERE panel_code='PU_ORDER' AND col_name IN (N'供应商编码', N'供应商', N'供应商代码');
SELECT COUNT(*) AS pu_order_fields FROM yj_field WHERE panel_code='PU_ORDER';
GO
