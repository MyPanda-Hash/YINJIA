SET NOCOUNT ON;
SELECT panel_code, panel_name, mode, group_col, pk_col, code_col, detail_key, config FROM yj_panel WHERE panel_code IN ('QC_INSP_REC_DETAIL','QC_INSP_REC');
SELECT seq, label, col_name, place, visible, hidden, ref_panel, ref_field, data_type FROM yj_field WHERE panel_code='QC_INSP_REC_DETAIL' ORDER BY seq;
