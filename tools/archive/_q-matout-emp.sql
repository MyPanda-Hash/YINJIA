SET NOCOUNT ON;
SELECT 'EMP' AS p, col_name, label, data_type, place, seq FROM yj_field WHERE panel_code='EMP' ORDER BY place, seq;
GO
SELECT 'WH' AS p, col_name, label, data_type, place, seq FROM yj_field WHERE panel_code='WH' ORDER BY place, seq;
GO
SELECT 'MANU_ORDER 行' AS p, col_name, label, data_type, ISNULL(ref_panel,'') AS rp, ISNULL(ref_field,'') AS rf, place, seq FROM yj_field WHERE panel_code='MANU_ORDER' ORDER BY place, seq;
GO
