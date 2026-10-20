SELECT TOP 20 scope, ref_key, locale, text FROM yj_translation WHERE ref_key IN (N'来料检验单号', N'检验数据记录单号', N'检验数据记录', N'来料检验单')
GO
SELECT N'残留检查' AS x, (SELECT COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID('dbo.qc_insp_rec') AND name=N'来料检验单号') AS rec_col, (SELECT COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID('dbo.qc_tc_in') AND name=N'检验数据记录单号') AS tc_col, (SELECT COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID('dbo.qc_tc_in') AND name LIKE N'附件%') AS tc_attach
GO
SELECT panel_code, label, place, seq, visible, hidden, editable FROM yj_field WHERE panel_code IN ('QC_TC_IN','QC_INSP_REC') AND (label LIKE N'%单号' OR place='header') AND panel_code='QC_TC_IN'
GO
SELECT N'特采单行数' AS x, COUNT(*) AS n FROM qc_tc_in
GO
SELECT TOP 5 单据编号, 检验单号, 产品名称, 检验数据记录单号 FROM qc_tc_in
