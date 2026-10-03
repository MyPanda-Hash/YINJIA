SET NOCOUNT ON;
SELECT id, place, seq, col_name, hidden, visible, alias, editable FROM yj_field
WHERE panel_code='QC_INSP' AND col_name IN (N'部门', N'部门编码') ORDER BY col_name, place;
GO
