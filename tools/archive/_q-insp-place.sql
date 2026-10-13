-- _q-insp-place.sql — 「多行文本」命中行的 place 明细:确认表头与明细是否共用同一行 yj_field
SET NOCOUNT ON;
SELECT panel_code, label, place, data_type, seq, visible, hidden, editable
FROM dbo.yj_field
WHERE panel_code IN (N'QC_MOLD_INSP', N'QC_CUT_INSP', N'QC_ASM_INSP')
  AND (data_type = N'多行文本' OR label IN (N'处理方式', N'备注', N'表区', N'行号', N'数量'))
ORDER BY panel_code, seq, label;

-- place 取值分布(看有没有 'a,b' 复合位)
SELECT place, COUNT(*) AS 行数
FROM dbo.yj_field
WHERE panel_code IN (N'QC_MOLD_INSP', N'QC_CUT_INSP', N'QC_ASM_INSP')
GROUP BY place ORDER BY place;
