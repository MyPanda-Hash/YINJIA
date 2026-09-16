SET NOCOUNT ON;
SELECT panel_code, col_name, label, ref_panel, ref_field, display_field, required FROM yj_field
WHERE panel_code IN ('PURCHASE_IN','SALE_OUT','SO_ORDER','PU_ORDER')
  AND place = 'detail' AND (col_name LIKE N'%仓库%' OR col_name LIKE N'%仓%')
  AND (required = 1 OR ISNULL(ref_panel,'') <> '')
ORDER BY panel_code, seq;
