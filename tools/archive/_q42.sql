SET NOCOUNT ON;
UPDATE yj_field SET ref_panel='GFDA', ref_field='dm', display_field='mc' WHERE panel_code='PURCHASE_IN' AND col_name=N'供应商编码' AND ref_panel='PARTNER';
UPDATE yj_field SET ref_panel='KHDA', ref_field='dm', display_field='mc' WHERE panel_code='SALE_OUT' AND col_name=N'客户编码' AND ref_panel='PARTNER';
UPDATE yj_field SET ref_panel='KHDA', ref_field='mc', display_field='mc' WHERE panel_code='SALE_OUT' AND col_name=N'结算客户' AND ref_panel='PARTNER';
SELECT COUNT(*) AS remaining FROM yj_field WHERE ref_panel='PARTNER' AND panel_code IN ('PURCHASE_IN','SALE_OUT','SO_ORDER','PU_ORDER');
