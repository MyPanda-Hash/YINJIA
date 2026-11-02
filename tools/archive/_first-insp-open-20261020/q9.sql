SELECT f.panel_code, f.label, f.col_name, f.place, f.seq, f.hidden
FROM dbo.yj_field f
WHERE f.panel_code IN (N'QC_PROC_INSP', N'QC_FIRST_INSP', N'QC_ASM_INSP')
  AND f.place LIKE N'%query%'
ORDER BY f.panel_code, f.seq, f.id
GO
