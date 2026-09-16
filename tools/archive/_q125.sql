SET NOCOUNT ON;
-- 四单据明细行仓库字段:data_type 改为"参照"(isRef() 检查 dataType=='参照')
UPDATE yj_field SET data_type = N'参照'
WHERE panel_code IN ('PURCHASE_IN','SALE_OUT','SO_ORDER','PU_ORDER')
  AND place='detail' AND col_name IN (N'仓库',N'仓库名称')
  AND ISNULL(ref_panel,'') <> '';
SELECT panel_code, col_name, data_type, ref_panel, ref_field FROM yj_field
WHERE panel_code IN ('PURCHASE_IN','SALE_OUT','SO_ORDER','PU_ORDER')
  AND place='detail' AND col_name IN (N'仓库',N'仓库名称') ORDER BY panel_code;
