SELECT name, TYPE_NAME(user_type_id) AS t, max_length FROM sys.columns WHERE object_id = OBJECT_ID('dbo.form_flow_link') ORDER BY column_id;
GO
SELECT TOP 5 * FROM form_flow_link WHERE target_panel_code='PURCHASE_IN' ORDER BY id DESC;
