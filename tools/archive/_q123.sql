SET NOCOUNT ON;
-- SO_ORDER 仓库名称:补参照
UPDATE yj_field SET ref_panel='WH', ref_field=N'仓库名称', display_field=N'仓库名称'
WHERE panel_code='SO_ORDER' AND place='detail' AND col_name=N'仓库名称';
-- 所有仓库字段:确保 ref_panel 都指向 WH
UPDATE yj_field SET ref_panel='WH', ref_field=N'仓库名称', display_field=N'仓库名称'
WHERE panel_code IN ('PURCHASE_IN','SALE_OUT','SO_ORDER','PU_ORDER')
  AND place='detail' AND col_name IN (N'仓库',N'仓库名称');
-- 验证
SELECT panel_code, col_name, ref_panel, ref_field, display_field FROM yj_field
WHERE panel_code IN ('PURCHASE_IN','SALE_OUT','SO_ORDER','PU_ORDER')
  AND place='detail' AND col_name IN (N'仓库',N'仓库名称') ORDER BY panel_code;
