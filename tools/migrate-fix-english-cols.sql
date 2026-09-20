-- migrate-fix-english-cols.sql — 修正剩余英文列名(sp_rename + yj_field + 译名;2026-09-16 终批)
-- 幂等(2026-09-17 收编入链时补守卫):仅当旧列存在且新列不存在时才 sp_rename;UPDATE 均为条件匹配,重跑无操作。
SET NOCOUNT ON;
-- PURCHASE_IN
IF COL_LENGTH('bd_purchase_in','creator_number') IS NOT NULL AND COL_LENGTH('bd_purchase_in',N'创建人编码') IS NULL EXEC sp_rename N'bd_purchase_in.[creator_number]', N'创建人编码', N'COLUMN';
UPDATE yj_field SET col_name=N'创建人编码', label=N'创建人编码' WHERE panel_code='PURCHASE_IN' AND col_name='creator_number';
UPDATE yj_translation SET ref_key=N'创建人编码' WHERE scope='field' AND ref_key='creator_number'
  AND NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'创建人编码');
IF COL_LENGTH('bd_purchase_in','modifier_number') IS NOT NULL AND COL_LENGTH('bd_purchase_in',N'修改人编码') IS NULL EXEC sp_rename N'bd_purchase_in.[modifier_number]', N'修改人编码', N'COLUMN';
UPDATE yj_field SET col_name=N'修改人编码', label=N'修改人编码' WHERE panel_code='PURCHASE_IN' AND col_name='modifier_number';
UPDATE yj_translation SET ref_key=N'修改人编码' WHERE scope='field' AND ref_key='modifier_number'
  AND NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'修改人编码');
IF COL_LENGTH('bd_purchase_in','auditor_number') IS NOT NULL AND COL_LENGTH('bd_purchase_in',N'审核人编码') IS NULL EXEC sp_rename N'bd_purchase_in.[auditor_number]', N'审核人编码', N'COLUMN';
UPDATE yj_field SET col_name=N'审核人编码', label=N'审核人编码' WHERE panel_code='PURCHASE_IN' AND col_name='auditor_number';
UPDATE yj_translation SET ref_key=N'审核人编码' WHERE scope='field' AND ref_key='auditor_number'
  AND NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'审核人编码');
IF COL_LENGTH('bd_purchase_in','total_unsettle_amount_for') IS NOT NULL AND COL_LENGTH('bd_purchase_in',N'未结算金额本位币') IS NULL EXEC sp_rename N'bd_purchase_in.[total_unsettle_amount_for]', N'未结算金额本位币', N'COLUMN';
UPDATE yj_field SET col_name=N'未结算金额本位币', label=N'未结算金额本位币' WHERE panel_code='PURCHASE_IN' AND col_name='total_unsettle_amount_for';
UPDATE yj_translation SET ref_key=N'未结算金额本位币' WHERE scope='field' AND ref_key='total_unsettle_amount_for'
  AND NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'未结算金额本位币');
IF COL_LENGTH('bd_purchase_in','edit_pay_type_number') IS NOT NULL AND COL_LENGTH('bd_purchase_in',N'付款方式编码') IS NULL EXEC sp_rename N'bd_purchase_in.[edit_pay_type_number]', N'付款方式编码', N'COLUMN';
UPDATE yj_field SET col_name=N'付款方式编码', label=N'付款方式编码' WHERE panel_code='PURCHASE_IN' AND col_name='edit_pay_type_number';
UPDATE yj_translation SET ref_key=N'付款方式编码' WHERE scope='field' AND ref_key='edit_pay_type_number'
  AND NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'付款方式编码');
IF COL_LENGTH('bd_purchase_in','edit_pay_account_number') IS NOT NULL AND COL_LENGTH('bd_purchase_in',N'付款账户编码') IS NULL EXEC sp_rename N'bd_purchase_in.[edit_pay_account_number]', N'付款账户编码', N'COLUMN';
UPDATE yj_field SET col_name=N'付款账户编码', label=N'付款账户编码' WHERE panel_code='PURCHASE_IN' AND col_name='edit_pay_account_number';
UPDATE yj_translation SET ref_key=N'付款账户编码' WHERE scope='field' AND ref_key='edit_pay_account_number'
  AND NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'付款账户编码');
IF COL_LENGTH('bl_purchase_in','cur_settle_amount_for') IS NOT NULL AND COL_LENGTH('bl_purchase_in',N'本次结算金额本位币') IS NULL EXEC sp_rename N'bl_purchase_in.[cur_settle_amount_for]', N'本次结算金额本位币', N'COLUMN';
UPDATE yj_field SET col_name=N'本次结算金额本位币', label=N'本次结算金额本位币' WHERE panel_code='PURCHASE_IN' AND col_name='cur_settle_amount_for';
UPDATE yj_translation SET ref_key=N'本次结算金额本位币' WHERE scope='field' AND ref_key='cur_settle_amount_for'
  AND NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'本次结算金额本位币');
-- SALE_OUT
IF COL_LENGTH('bd_sale_out','attachments') IS NOT NULL AND COL_LENGTH('bd_sale_out',N'附件') IS NULL EXEC sp_rename N'bd_sale_out.[attachments]', N'附件', N'COLUMN';
UPDATE yj_field SET col_name=N'附件', label=N'附件' WHERE panel_code='SALE_OUT' AND col_name='attachments';
UPDATE yj_translation SET ref_key=N'附件' WHERE scope='field' AND ref_key='attachments'
  AND NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'附件');
IF COL_LENGTH('bd_sale_out','auditor_number') IS NOT NULL AND COL_LENGTH('bd_sale_out',N'审核人编码') IS NULL EXEC sp_rename N'bd_sale_out.[auditor_number]', N'审核人编码', N'COLUMN';
UPDATE yj_field SET col_name=N'审核人编码', label=N'审核人编码' WHERE panel_code='SALE_OUT' AND col_name='auditor_number';
UPDATE yj_translation SET ref_key=N'审核人编码' WHERE scope='field' AND ref_key='auditor_number'
  AND NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'审核人编码');
IF COL_LENGTH('bd_sale_out','creator_number') IS NOT NULL AND COL_LENGTH('bd_sale_out',N'创建人编码') IS NULL EXEC sp_rename N'bd_sale_out.[creator_number]', N'创建人编码', N'COLUMN';
UPDATE yj_field SET col_name=N'创建人编码', label=N'创建人编码' WHERE panel_code='SALE_OUT' AND col_name='creator_number';
UPDATE yj_translation SET ref_key=N'创建人编码' WHERE scope='field' AND ref_key='creator_number'
  AND NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'创建人编码');
IF COL_LENGTH('bd_sale_out','modifier_number') IS NOT NULL AND COL_LENGTH('bd_sale_out',N'修改人编码') IS NULL EXEC sp_rename N'bd_sale_out.[modifier_number]', N'修改人编码', N'COLUMN';
UPDATE yj_field SET col_name=N'修改人编码', label=N'修改人编码' WHERE panel_code='SALE_OUT' AND col_name='modifier_number';
UPDATE yj_translation SET ref_key=N'修改人编码' WHERE scope='field' AND ref_key='modifier_number'
  AND NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'修改人编码');
PRINT N'英文列名修正完成';
GO
