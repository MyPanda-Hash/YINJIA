-- 四张检验单的「表区 / 检查频率」登记情况(带入时要不要写表区)
SELECT panel_code, col_name, place, seq, visible, hidden
FROM dbo.yj_field
WHERE panel_code IN (N'QC_ASM_INSP', N'QC_MOLD_INSP', N'QC_CUT_INSP', N'QC_PROC_INSP', N'QC_FIRST_INSP')
  AND col_name IN (N'表区', N'检查频率')
ORDER BY panel_code, col_name;
