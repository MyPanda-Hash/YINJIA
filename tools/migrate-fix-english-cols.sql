-- 修正剩余英文列名(sp_rename + yj_field + 译名)
SET NOCOUNT ON;
-- PURCHASE_IN
EXEC sp_rename N'bd_purchase_in.[creator_number]', N'创建人编码', N'COLUMN';
UPDATE yj_field SET col_name=N'创建人编码', label=N'创建人编码' WHERE panel_code='PURCHASE_IN' AND col_name='creator_number';
UPDATE yj_translation SET ref_key=N'创建人编码' WHERE scope='field' AND ref_key='creator_number';
EXEC sp_rename N'bd_purchase_in.[modifier_number]', N'修改人编码', N'COLUMN';
UPDATE yj_field SET col_name=N'修改人编码', label=N'修改人编码' WHERE panel_code='PURCHASE_IN' AND col_name='modifier_number';
UPDATE yj_translation SET ref_key=N'修改人编码' WHERE scope='field' AND ref_key='modifier_number';
EXEC sp_rename N'bd_purchase_in.[auditor_number]', N'审核人编码', N'COLUMN';
UPDATE yj_field SET col_name=N'审核人编码', label=N'审核人编码' WHERE panel_code='PURCHASE_IN' AND col_name='auditor_number';
UPDATE yj_translation SET ref_key=N'审核人编码' WHERE scope='field' AND ref_key='auditor_number';
EXEC sp_rename N'bd_purchase_in.[total_unsettle_amount_for]', N'未结算金额本位币', N'COLUMN';
UPDATE yj_field SET col_name=N'未结算金额本位币', label=N'未结算金额本位币' WHERE panel_code='PURCHASE_IN' AND col_name='total_unsettle_amount_for';
UPDATE yj_translation SET ref_key=N'未结算金额本位币' WHERE scope='field' AND ref_key='total_unsettle_amount_for';
EXEC sp_rename N'bd_purchase_in.[edit_pay_type_number]', N'付款方式编码', N'COLUMN';
UPDATE yj_field SET col_name=N'付款方式编码', label=N'付款方式编码' WHERE panel_code='PURCHASE_IN' AND col_name='edit_pay_type_number';
UPDATE yj_translation SET ref_key=N'付款方式编码' WHERE scope='field' AND ref_key='edit_pay_type_number';
EXEC sp_rename N'bd_purchase_in.[edit_pay_account_number]', N'付款账户编码', N'COLUMN';
UPDATE yj_field SET col_name=N'付款账户编码', label=N'付款账户编码' WHERE panel_code='PURCHASE_IN' AND col_name='edit_pay_account_number';
UPDATE yj_translation SET ref_key=N'付款账户编码' WHERE scope='field' AND ref_key='edit_pay_account_number';
EXEC sp_rename N'bl_purchase_in.[cur_settle_amount_for]', N'本次结算金额本位币', N'COLUMN';
UPDATE yj_field SET col_name=N'本次结算金额本位币', label=N'本次结算金额本位币' WHERE panel_code='PURCHASE_IN' AND col_name='cur_settle_amount_for';
UPDATE yj_translation SET ref_key=N'本次结算金额本位币' WHERE scope='field' AND ref_key='cur_settle_amount_for';
-- SALE_OUT
EXEC sp_rename N'bd_sale_out.[attachments]', N'附件', N'COLUMN';
UPDATE yj_field SET col_name=N'附件', label=N'附件' WHERE panel_code='SALE_OUT' AND col_name='attachments';
UPDATE yj_translation SET ref_key=N'附件' WHERE scope='field' AND ref_key='attachments';
EXEC sp_rename N'bd_sale_out.[auditor_number]', N'审核人编码', N'COLUMN';
UPDATE yj_field SET col_name=N'审核人编码', label=N'审核人编码' WHERE panel_code='SALE_OUT' AND col_name='auditor_number';
UPDATE yj_translation SET ref_key=N'审核人编码' WHERE scope='field' AND ref_key='auditor_number';
EXEC sp_rename N'bd_sale_out.[creator_number]', N'创建人编码', N'COLUMN';
UPDATE yj_field SET col_name=N'创建人编码', label=N'创建人编码' WHERE panel_code='SALE_OUT' AND col_name='creator_number';
UPDATE yj_translation SET ref_key=N'创建人编码' WHERE scope='field' AND ref_key='creator_number';
EXEC sp_rename N'bd_sale_out.[modifier_number]', N'修改人编码', N'COLUMN';
UPDATE yj_field SET col_name=N'修改人编码', label=N'修改人编码' WHERE panel_code='SALE_OUT' AND col_name='modifier_number';
UPDATE yj_translation SET ref_key=N'修改人编码' WHERE scope='field' AND ref_key='modifier_number';
PRINT N'英文列名修正完成';
GO
