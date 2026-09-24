SET NOCOUNT ON;
SELECT id, col_name, place, hidden, visible FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'仓库';
GO
