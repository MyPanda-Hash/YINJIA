SET NOCOUNT ON;
SELECT id, place, seq, col_name, hidden, visible, alias FROM yj_field WHERE panel_code='QC_INSP' AND place LIKE '%header%' ORDER BY seq, id;
GO
