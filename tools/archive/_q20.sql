-- 修正:去掉 _api后缀(原 MES 占用字段已删,原名空出可用)
SET NOCOUNT ON;
-- PURCHASE_IN
EXEC sp_rename N'bd_purchase_in.[单据状态_bill_status]', N'单据状态2', N'COLUMN';
UPDATE yj_field SET col_name=N'单据状态2', label=N'单据状态2' WHERE panel_code='PURCHASE_IN' AND col_name=N'单据状态_bill_status';
UPDATE yj_translation SET ref_key=N'单据状态2' WHERE scope='field' AND ref_key=N'单据状态_bill_status';
EXEC sp_rename N'bd_purchase_in.[审核时间_audit_time]', N'审核时间2', N'COLUMN';
UPDATE yj_field SET col_name=N'审核时间2', label=N'审核时间2' WHERE panel_code='PURCHASE_IN' AND col_name=N'审核时间_audit_time';
UPDATE yj_translation SET ref_key=N'审核时间2' WHERE scope='field' AND ref_key=N'审核时间_audit_time';
EXEC sp_rename N'bd_purchase_in.[审核人_auditor_name]', N'审核人2', N'COLUMN';
UPDATE yj_field SET col_name=N'审核人2', label=N'审核人2' WHERE panel_code='PURCHASE_IN' AND col_name=N'审核人_auditor_name';
UPDATE yj_translation SET ref_key=N'审核人2' WHERE scope='field' AND ref_key=N'审核人_auditor_name';
EXEC sp_rename N'bd_purchase_in.[仓库名称_sp_name]', N'仓位名称', N'COLUMN';
UPDATE yj_field SET col_name=N'仓位名称', label=N'仓位名称' WHERE panel_code='PURCHASE_IN' AND col_name=N'仓库名称_sp_name';
UPDATE yj_translation SET ref_key=N'仓位名称' WHERE scope='field' AND ref_key=N'仓库名称_sp_name';
EXEC sp_rename N'bl_purchase_in.[换算率_conversion_rate]', N'换算率2', N'COLUMN';
UPDATE yj_field SET col_name=N'换算率2', label=N'换算率2' WHERE panel_code='PURCHASE_IN' AND col_name=N'换算率_conversion_rate';
UPDATE yj_translation SET ref_key=N'换算率2' WHERE scope='field' AND ref_key=N'换算率_conversion_rate';
-- SALE_OUT
EXEC sp_rename N'bd_sale_out.[单据状态_bill_status]', N'单据状态2', N'COLUMN';
UPDATE yj_field SET col_name=N'单据状态2', label=N'单据状态2' WHERE panel_code='SALE_OUT' AND col_name=N'单据状态_bill_status';
UPDATE yj_translation SET ref_key=N'单据状态2' WHERE scope='field' AND ref_key=N'单据状态_bill_status';
UPDATE yj_field SET col_name=N'开票状态', label=N'开票状态' WHERE panel_code='SALE_OUT' AND col_name LIKE N'ivc_status%';
EXEC sp_rename N'bd_sale_out.[发货人_dispatcher_linkman]', N'发货人2', N'COLUMN';
UPDATE yj_field SET col_name=N'发货人2', label=N'发货人2' WHERE panel_code='SALE_OUT' AND col_name=N'发货人_dispatcher_linkman';
UPDATE yj_translation SET ref_key=N'发货人2' WHERE scope='field' AND ref_key=N'发货人_dispatcher_linkman';
EXEC sp_rename N'bd_sale_out.[审核人_auditor_name]', N'审核人2', N'COLUMN';
UPDATE yj_field SET col_name=N'审核人2', label=N'审核人2' WHERE panel_code='SALE_OUT' AND col_name=N'审核人_auditor_name';
UPDATE yj_translation SET ref_key=N'审核人2' WHERE scope='field' AND ref_key=N'审核人_auditor_name';
EXEC sp_rename N'bd_sale_out.[审核时间_audit_time]', N'审核时间2', N'COLUMN';
UPDATE yj_field SET col_name=N'审核时间2', label=N'审核时间2' WHERE panel_code='SALE_OUT' AND col_name=N'审核时间_audit_time';
UPDATE yj_translation SET ref_key=N'审核时间2' WHERE scope='field' AND ref_key=N'审核时间_audit_time';
EXEC sp_rename N'bd_sale_out.[部门_dept_name]', N'部门2', N'COLUMN';
UPDATE yj_field SET col_name=N'部门2', label=N'部门2' WHERE panel_code='SALE_OUT' AND col_name=N'部门_dept_name';
UPDATE yj_translation SET ref_key=N'部门2' WHERE scope='field' AND ref_key=N'部门_dept_name';
EXEC sp_rename N'bd_sale_out.[仓库名称_sp_name]', N'仓位名称', N'COLUMN';
UPDATE yj_field SET col_name=N'仓位名称', label=N'仓位名称' WHERE panel_code='SALE_OUT' AND col_name=N'仓库名称_sp_name';
UPDATE yj_translation SET ref_key=N'仓位名称' WHERE scope='field' AND ref_key=N'仓库名称_sp_name';
EXEC sp_rename N'bl_sale_out.[税额_tax_amount]', N'税额', N'COLUMN';
UPDATE yj_field SET col_name=N'税额', label=N'税额' WHERE panel_code='SALE_OUT' AND col_name=N'税额_tax_amount';
UPDATE yj_translation SET ref_key=N'税额' WHERE scope='field' AND ref_key=N'税额_tax_amount';
EXEC sp_rename N'bl_sale_out.[折扣金额_dis_amount]', N'折扣金额2', N'COLUMN';
UPDATE yj_field SET col_name=N'折扣金额2', label=N'折扣金额2' WHERE panel_code='SALE_OUT' AND col_name=N'折扣金额_dis_amount';
UPDATE yj_translation SET ref_key=N'折扣金额2' WHERE scope='field' AND ref_key=N'折扣金额_dis_amount';
-- ivc_status 尾空格列名修正
IF COL_LENGTH('dbo.bd_sale_out', N'ivc_status ') IS NOT NULL BEGIN
  EXEC sp_rename N'bd_sale_out.[ivc_status ]', N'开票状态', N'COLUMN';
END
PRINT N'后缀标签修正完成';
GO
