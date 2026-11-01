SET NOCOUNT ON;
SELECT seq, label, col_name, place, visible, hidden, editable FROM yj_field WHERE panel_code='WO_REPORT' AND seq BETWEEN 25 AND 65 ORDER BY seq;
GO
