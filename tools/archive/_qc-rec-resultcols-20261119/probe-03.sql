SET NOCOUNT ON;
SELECT id, col_name, label, place, seq, visible, hidden, editable, data_type
  FROM yj_field WHERE panel_code = N'QC_INSP_REC_DETAIL' ORDER BY seq, id;
