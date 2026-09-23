SET NOCOUNT ON;
UPDATE yj_field SET hidden = 1, visible = 0 WHERE panel_code = 'SO_ORDER' AND col_name = N'仓库';
SELECT panel_code, col_name, required, hidden, visible FROM yj_field
 WHERE panel_code IN ('PURCHASE_IN','SALE_OUT','SO_ORDER') AND col_name = N'仓库';
GO
