SET NOCOUNT ON;
SELECT 'FINISH_IN_DETAIL 字段' AS k, col_name, label, place FROM yj_field WHERE panel_code='FINISH_IN_DETAIL' ORDER BY seq, id;
GO
SELECT 'FINISH_IN_STATS 字段' AS k, col_name, label, place FROM yj_field WHERE panel_code='FINISH_IN_STATS' ORDER BY seq, id;
GO
SELECT LEFT(m.definition, 1500) AS material_out_detail_def FROM sys.sql_modules m WHERE m.object_id = OBJECT_ID('dbo.v_material_out_detail');
