SELECT panel_code, seq, label, place, visible, hidden, required, editable, ref_panel, ref_field
FROM yj_field WHERE panel_code='QC_INSP_REC' ORDER BY seq, id
GO
SELECT TOP 5 单据编号, 物料名称, 物料批次, 检验结论, 备用1 FROM qc_insp_rec ORDER BY id DESC
