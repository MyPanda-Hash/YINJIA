SET NOCOUNT ON;
-- 看现有必填设置(yj_field.required=1)
SELECT panel_code, col_name, label, place FROM yj_field
WHERE panel_code IN ('SO_ORDER','PU_ORDER','PURCHASE_IN','SALE_OUT') AND required=1
ORDER BY panel_code, seq;
-- 看现有自动计算(dict_sql 含计算逻辑的)
SELECT panel_code, col_name, label, dict_sql FROM yj_field
WHERE panel_code IN ('SO_ORDER','PU_ORDER','PURCHASE_IN','SALE_OUT') AND ISNULL(dict_sql,'')<>''
ORDER BY panel_code, seq;
