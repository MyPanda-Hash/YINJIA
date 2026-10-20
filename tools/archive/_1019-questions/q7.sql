SELECT panel_code, seq, label, place, visible, hidden, required, editable, ref_panel, ref_field
FROM yj_field WHERE panel_code IN ('QC_INSP_REC') ORDER BY seq, id
GO
SELECT c.name AS 列名, t.name AS 类型 FROM sys.columns c JOIN sys.types t ON t.user_type_id=c.user_type_id WHERE c.object_id=OBJECT_ID('dbo.qc_insp_rec') ORDER BY c.column_id
