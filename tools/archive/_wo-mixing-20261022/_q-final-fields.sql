SET NOCOUNT ON;
SELECT seq, label, data_type, place, width FROM dbo.yj_field WHERE panel_code='WO_MIXING_LIST' ORDER BY seq;
