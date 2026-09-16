-- 补:修正遗留 PARTNER 参照
SET NOCOUNT ON;
UPDATE yj_field SET ref_panel='GFDA', ref_field='dm', display_field='mc'
WHERE panel_code='PURCHASE_IN' AND col_name=N'供应商编码' AND ref_panel='PARTNER';
UPDATE yj_field SET ref_panel='KHDA', ref_field='dm', display_field='mc'
WHERE panel_code='SALE_OUT' AND col_name=N'客户编码' AND ref_panel='PARTNER';
UPDATE yj_field SET ref_panel='KHDA', ref_field='mc', display_field='mc'
WHERE panel_code='SALE_OUT' AND col_name=N'结算客户' AND ref_panel='PARTNER';
-- PU_ORDER.仓库 ref_field 改为编码匹配
UPDATE yj_field SET ref_field=N'仓库编码', display_field=N'仓库名称'
WHERE panel_code='PU_ORDER' AND col_name=N'仓库' AND ref_panel='WH';
GO
PRINT N'遗留参照修正完成';
GO
