SET NOCOUNT ON;
SELECT name, type_desc FROM sys.objects WHERE name IN ('v_manu_schedule','v_line_load','v_manu_order_detail','v_wo_kit') ORDER BY name;
