SELECT panel_code, seq, label, place, visible, hidden, required, editable, ref_panel, ref_field, col_name, [type], options
FROM yj_field WHERE panel_code IN ('QC_TC_IN') ORDER BY seq, id
GO
SELECT panel_code, COUNT(*) AS 字段数 FROM yj_field WHERE panel_code IN ('QC_TC_IN','QC_INSP','QC_INSP_REC','QC_BHG','QC_BHC','QC_BHZ','QC_JJF','QC_SCP','QC_LYB','QC_SCY','QC_RETURN','QC_RECV') GROUP BY panel_code
