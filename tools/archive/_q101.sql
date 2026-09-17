SET NOCOUNT ON;
-- 四单据明细行的仓库字段:必填设置+可见性
SELECT panel_code, col_name, label, required, ISNULL(hidden,0) AS hidden, place FROM yj_field
WHERE panel_code IN ('PURCHASE_IN','SALE_OUT','SO_ORDER','PU_ORDER')
  AND place='detail' AND (col_name LIKE N'%仓库%' OR col_name LIKE N'%仓%')
ORDER BY panel_code, seq;
