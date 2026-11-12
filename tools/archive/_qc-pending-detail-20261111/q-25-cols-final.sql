SET NOCOUNT ON;
SELECT seq, label, col_name, visible, hidden FROM yj_field
 WHERE panel_code = N'QC_INSP_REC_DETAIL' ORDER BY seq, id;
