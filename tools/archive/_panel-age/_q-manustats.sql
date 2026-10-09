SET NOCOUNT ON;
SELECT LEFT(m.definition, 700) AS def FROM sys.sql_modules m WHERE m.object_id = OBJECT_ID('dbo.v_manu_order_stats');
GO
SELECT col_name, label FROM yj_field WHERE panel_code='MANU_ORDER_STATS' ORDER BY seq, id;
