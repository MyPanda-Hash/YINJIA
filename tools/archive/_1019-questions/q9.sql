SELECT seq, label, place, visible, hidden, required, editable, ref_panel, ref_field
FROM yj_field WHERE panel_code='QC_INSP_REC' ORDER BY seq, id
GO
SELECT seq, label, place, visible, hidden, required, editable, ref_panel, ref_field
FROM yj_field WHERE panel_code='QC_INSP' ORDER BY seq, id
