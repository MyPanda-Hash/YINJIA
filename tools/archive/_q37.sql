SET NOCOUNT ON;
-- 看现有 SO/PU 的参照字段设计(ref_panel/ref_field/display_field)
SELECT panel_code, col_name, label, ref_panel, ref_field, display_field
FROM yj_field
WHERE panel_code IN ('SO_ORDER','PU_ORDER') AND ISNULL(ref_panel,'')<>''
ORDER BY panel_code, seq;
