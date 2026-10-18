SET NOCOUNT ON;
SELECT panel_code, label, col_name, place, visible, hidden FROM dbo.yj_field WHERE label IN (N'检验员', N'工序', N'报工数量', N'检验类别') AND panel_code IN (N'QC_ASM_INSP',N'QC_PROC_INSP',N'QC_FIRST_INSP') ORDER BY panel_code, label;
GO
