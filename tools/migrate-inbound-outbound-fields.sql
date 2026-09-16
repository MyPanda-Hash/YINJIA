-- migrate-inbound-outbound-fields.sql — 采购入库/销售出库面板字段与接口并集对应(不含同步脚本)
-- 生成器:tools/archive/_gen-inbound-outbound.mjs(标签=订单已验证覆盖表;默认隐藏 id/创建修改/附件/费用分录)
USE HSDZ_MES;
SET NOCOUNT ON;
GO

-- ══ PURCHASE_IN(PUR_IN):头补 86 行补 66 ══
IF COL_LENGTH('dbo.bd_purchase_in', N'创建时间') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [创建时间] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'创建时间')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'创建时间', N'创建时间', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'创建时间' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'创建时间', 'en', N'Create Time', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'单据状态_bill_status') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [单据状态_bill_status] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'单据状态_bill_status')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'单据状态_bill_status', N'单据状态_bill_status', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'单据状态_bill_status' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'单据状态_bill_status', 'en', N'Bill Status', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'单据关闭状态') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [单据关闭状态] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'单据关闭状态')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'单据关闭状态', N'单据关闭状态', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'单据关闭状态' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'单据关闭状态', 'en', N'Bill Close State', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'supplier_id') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [supplier_id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'supplier_id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'supplier_id', N'supplier_id', N'文本', N'header', 970, 130, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'supplier_id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'supplier_id', 'en', N'Supplier Id', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'emp_id') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [emp_id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'emp_id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'emp_id', N'emp_id', N'文本', N'header', 970, 130, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'emp_id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'emp_id', 'en', N'Emp Id', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'经手人编码') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [经手人编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'经手人编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'经手人编码', N'经手人编码', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'经手人编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'经手人编码', 'en', N'Emp Number', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'金额') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [金额] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'金额')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'金额', N'金额', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'金额' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'金额', 'en', N'Total Amount', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'delivery_type_id') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [delivery_type_id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'delivery_type_id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'delivery_type_id', N'delivery_type_id', N'文本', N'header', 970, 130, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'delivery_type_id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'delivery_type_id', 'en', N'Delivery Type Id', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'交货方式') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [交货方式] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'交货方式')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'交货方式', N'交货方式', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'交货方式' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'交货方式', 'en', N'Delivery Type Name', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'交货方式编码') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [交货方式编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'交货方式编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'交货方式编码', N'交货方式编码', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'交货方式编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'交货方式编码', 'en', N'Delivery Type Number', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'结算状态') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [结算状态] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'结算状态')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'结算状态', N'结算状态', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'结算状态' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'结算状态', 'en', N'Settle Status', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'修改时间') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [修改时间] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'修改时间')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'修改时间', N'修改时间', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'修改时间' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'修改时间', 'en', N'Modify Time', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'审核时间_audit_time') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [审核时间_audit_time] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'审核时间_audit_time')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'审核时间_audit_time', N'审核时间_audit_time', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'审核时间_audit_time' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'审核时间_audit_time', 'en', N'Audit Time', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'creator_id') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [creator_id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'creator_id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'creator_id', N'creator_id', N'文本', N'header', 970, 130, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'creator_id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'creator_id', 'en', N'Creator Id', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'创建人') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [创建人] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'创建人')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'创建人', N'创建人', N'文本', N'header', 970, 130, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'创建人' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'创建人', 'en', N'Creator Name', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'creator_number') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [creator_number] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'creator_number')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'creator_number', N'creator_number', N'文本', N'header', 970, 130, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'creator_number' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'creator_number', 'en', N'Creator Number', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'modifier_id') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [modifier_id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'modifier_id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'modifier_id', N'modifier_id', N'文本', N'header', 970, 130, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'modifier_id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'modifier_id', 'en', N'Modifier Id', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'修改人') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [修改人] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'修改人')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'修改人', N'修改人', N'文本', N'header', 970, 130, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'修改人' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'修改人', 'en', N'Modifier Name', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'modifier_number') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [modifier_number] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'modifier_number')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'modifier_number', N'modifier_number', N'文本', N'header', 970, 130, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'modifier_number' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'modifier_number', 'en', N'Modifier Number', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'auditor_id') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [auditor_id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'auditor_id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'auditor_id', N'auditor_id', N'文本', N'header', 970, 130, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'auditor_id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'auditor_id', 'en', N'Auditor Id', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'审核人_auditor_name') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [审核人_auditor_name] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'审核人_auditor_name')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'审核人_auditor_name', N'审核人_auditor_name', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'审核人_auditor_name' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'审核人_auditor_name', 'en', N'Auditor Name', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'auditor_number') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [auditor_number] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'auditor_number')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'auditor_number', N'auditor_number', N'文本', N'header', 970, 130, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'auditor_number' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'auditor_number', 'en', N'Auditor Number', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'交易类型') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [交易类型] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'交易类型')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'交易类型', N'交易类型', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'交易类型' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'交易类型', 'en', N'Trans Type', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'dept_id') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [dept_id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'dept_id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'dept_id', N'dept_id', N'文本', N'header', 970, 130, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'dept_id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'dept_id', 'en', N'Dept Id', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'部门') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [部门] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'部门')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'部门', N'部门', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'部门' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'部门', 'en', N'Dept Name', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'部门编码') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [部门编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'部门编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'部门编码', N'部门编码', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'部门编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'部门编码', 'en', N'Dept Number', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'customer_id') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [customer_id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'customer_id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'customer_id', N'customer_id', N'文本', N'header', 970, 130, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'customer_id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'customer_id', 'en', N'Customer Id', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'客户') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [客户] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'客户')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'客户', N'客户', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'客户' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'客户', 'en', N'Customer Name', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'客户编码') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [客户编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'客户编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'客户编码', N'客户编码', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'客户编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'客户编码', 'en', N'Customer Number', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'联系人电话') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [联系人电话] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'联系人电话')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'联系人电话', N'联系人电话', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'联系人电话' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'联系人电话', 'en', N'Contact Phone', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'contact_country_id') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [contact_country_id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'contact_country_id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'contact_country_id', N'contact_country_id', N'文本', N'header', 970, 130, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'contact_country_id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'contact_country_id', 'en', N'Contact Country Id', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'联系人国家名称') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [联系人国家名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'联系人国家名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'联系人国家名称', N'联系人国家名称', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'联系人国家名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'联系人国家名称', 'en', N'Contact Country Name', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'联系人国家编码') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [联系人国家编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'联系人国家编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'联系人国家编码', N'联系人国家编码', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'联系人国家编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'联系人国家编码', 'en', N'Contact Country Number', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'contact_province_id') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [contact_province_id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'contact_province_id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'contact_province_id', N'contact_province_id', N'文本', N'header', 970, 130, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'contact_province_id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'contact_province_id', 'en', N'Contact Province Id', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'联系人省份名称') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [联系人省份名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'联系人省份名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'联系人省份名称', N'联系人省份名称', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'联系人省份名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'联系人省份名称', 'en', N'Contact Province Name', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'联系人省份编码') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [联系人省份编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'联系人省份编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'联系人省份编码', N'联系人省份编码', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'联系人省份编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'联系人省份编码', 'en', N'Contact Province Number', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'contact_city_id') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [contact_city_id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'contact_city_id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'contact_city_id', N'contact_city_id', N'文本', N'header', 970, 130, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'contact_city_id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'contact_city_id', 'en', N'Contact City Id', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'联系人市区名称') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [联系人市区名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'联系人市区名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'联系人市区名称', N'联系人市区名称', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'联系人市区名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'联系人市区名称', 'en', N'Contact City Name', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'联系人市区编码') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [联系人市区编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'联系人市区编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'联系人市区编码', N'联系人市区编码', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'联系人市区编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'联系人市区编码', 'en', N'Contact City Number', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'contact_district_id') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [contact_district_id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'contact_district_id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'contact_district_id', N'contact_district_id', N'文本', N'header', 970, 130, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'contact_district_id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'contact_district_id', 'en', N'Contact District Id', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'联系人区县名称') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [联系人区县名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'联系人区县名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'联系人区县名称', N'联系人区县名称', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'联系人区县名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'联系人区县名称', 'en', N'Contact District Name', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'联系人区县编码') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [联系人区县编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'联系人区县编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'联系人区县编码', N'联系人区县编码', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'联系人区县编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'联系人区县编码', 'en', N'Contact District Number', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'联系地址') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [联系地址] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'联系地址')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'联系地址', N'联系地址', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'联系地址' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'联系地址', 'en', N'Contact Address', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'未结算金额') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [未结算金额] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'未结算金额')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'未结算金额', N'未结算金额', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'未结算金额' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'未结算金额', 'en', N'Total Unsettle Amount', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'total_unsettle_amount_for') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [total_unsettle_amount_for] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'total_unsettle_amount_for')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'total_unsettle_amount_for', N'total_unsettle_amount_for', N'文本', N'header', 970, 130, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'total_unsettle_amount_for' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'total_unsettle_amount_for', 'en', N'Total Unsettle Amount For', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'应收款余额') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [应收款余额] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'应收款余额')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'应收款余额', N'应收款余额', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'应收款余额' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'应收款余额', 'en', N'All Debt', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'上次欠款') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [上次欠款] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'上次欠款')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'上次欠款', N'上次欠款', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'上次欠款' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'上次欠款', 'en', N'Last Debt', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'edit_pay_type_id') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [edit_pay_type_id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'edit_pay_type_id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'edit_pay_type_id', N'edit_pay_type_id', N'文本', N'header', 970, 130, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'edit_pay_type_id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'edit_pay_type_id', 'en', N'Edit Pay Type Id', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'付款方式') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [付款方式] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'付款方式')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'付款方式', N'付款方式', N'文本', N'header', 970, 130, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'付款方式' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'付款方式', 'en', N'Edit Pay Type Name', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'edit_pay_type_number') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [edit_pay_type_number] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'edit_pay_type_number')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'edit_pay_type_number', N'edit_pay_type_number', N'文本', N'header', 970, 130, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'edit_pay_type_number' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'edit_pay_type_number', 'en', N'Edit Pay Type Number', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'预付金额') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [预付金额] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'预付金额')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'预付金额', N'预付金额', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'预付金额' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'预付金额', 'en', N'Total Pre Amount', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'整单折扣额') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [整单折扣额] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'整单折扣额')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'整单折扣额', N'整单折扣额', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'整单折扣额' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'整单折扣额', 'en', N'Bill Dis Amount', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'edit_pay_account_id') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [edit_pay_account_id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'edit_pay_account_id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'edit_pay_account_id', N'edit_pay_account_id', N'文本', N'header', 970, 130, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'edit_pay_account_id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'edit_pay_account_id', 'en', N'Edit Pay Account Id', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'付款账户') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [付款账户] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'付款账户')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'付款账户', N'付款账户', N'文本', N'header', 970, 130, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'付款账户' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'付款账户', 'en', N'Edit Pay Account Name', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'edit_pay_account_number') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [edit_pay_account_number] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'edit_pay_account_number')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'edit_pay_account_number', N'edit_pay_account_number', N'文本', N'header', 970, 130, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'edit_pay_account_number' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'edit_pay_account_number', 'en', N'Edit Pay Account Number', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'整单折扣率%') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [整单折扣率%] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'整单折扣率%')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'整单折扣率%', N'整单折扣率%', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'整单折扣率%' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'整单折扣率%', 'en', N'Bill Dis Rate', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'保险金额') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [保险金额] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'保险金额')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'保险金额', N'保险金额', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'保险金额' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'保险金额', 'en', N'Total Ins Amount', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'商品分录') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [商品分录] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'商品分录')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'商品分录', N'商品分录', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'商品分录' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'商品分录', 'en', N'Material Entity', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'币种id') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [币种id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'币种id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'币种id', N'币种id', N'文本', N'header', 970, 130, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'币种id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'币种id', 'en', N'Currency Id', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'到期日') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [到期日] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'到期日')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'到期日', N'到期日', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'到期日' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'到期日', 'en', N'Due Date', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'setting_term_id') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [setting_term_id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'setting_term_id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'setting_term_id', N'setting_term_id', N'文本', N'header', 970, 130, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'setting_term_id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'setting_term_id', 'en', N'Setting Term Id', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'结算期限编码') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [结算期限编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'结算期限编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'结算期限编码', N'结算期限编码', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'结算期限编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'结算期限编码', 'en', N'Setting Term Number', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'结算期限') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [结算期限] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'结算期限')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'结算期限', N'结算期限', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'结算期限' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'结算期限', 'en', N'Setting Term Name', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'发货人') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [发货人] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'发货人')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'发货人', N'发货人', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'发货人' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'发货人', 'en', N'Dispatcher Linkman', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'发货电话') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [发货电话] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'发货电话')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'发货电话', N'发货电话', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'发货电话' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'发货电话', 'en', N'Dispatcher Phone', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'发货地址') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [发货地址] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'发货地址')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'发货地址', N'发货地址', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'发货地址' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'发货地址', 'en', N'Dispatcher Address', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'dispatcher_country_id') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [dispatcher_country_id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'dispatcher_country_id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'dispatcher_country_id', N'dispatcher_country_id', N'文本', N'header', 970, 130, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'dispatcher_country_id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'dispatcher_country_id', 'en', N'Dispatcher Country Id', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'发货国家名称') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [发货国家名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'发货国家名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'发货国家名称', N'发货国家名称', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'发货国家名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'发货国家名称', 'en', N'Dispatcher Country Name', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'发货国家编码') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [发货国家编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'发货国家编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'发货国家编码', N'发货国家编码', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'发货国家编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'发货国家编码', 'en', N'Dispatcher Country Number', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'dispatcher_province_id') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [dispatcher_province_id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'dispatcher_province_id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'dispatcher_province_id', N'dispatcher_province_id', N'文本', N'header', 970, 130, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'dispatcher_province_id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'dispatcher_province_id', 'en', N'Dispatcher Province Id', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'发货省份名称') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [发货省份名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'发货省份名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'发货省份名称', N'发货省份名称', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'发货省份名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'发货省份名称', 'en', N'Dispatcher Province Name', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'发货省份编码') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [发货省份编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'发货省份编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'发货省份编码', N'发货省份编码', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'发货省份编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'发货省份编码', 'en', N'Dispatcher Province Number', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'dispatcher_city_id') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [dispatcher_city_id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'dispatcher_city_id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'dispatcher_city_id', N'dispatcher_city_id', N'文本', N'header', 970, 130, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'dispatcher_city_id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'dispatcher_city_id', 'en', N'Dispatcher City Id', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'发货市区名称') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [发货市区名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'发货市区名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'发货市区名称', N'发货市区名称', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'发货市区名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'发货市区名称', 'en', N'Dispatcher City Name', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'发货市区编码') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [发货市区编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'发货市区编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'发货市区编码', N'发货市区编码', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'发货市区编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'发货市区编码', 'en', N'Dispatcher City Number', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'dispatcher_district_id') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [dispatcher_district_id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'dispatcher_district_id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'dispatcher_district_id', N'dispatcher_district_id', N'文本', N'header', 970, 130, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'dispatcher_district_id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'dispatcher_district_id', 'en', N'Dispatcher District Id', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'发货区县名称') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [发货区县名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'发货区县名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'发货区县名称', N'发货区县名称', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'发货区县名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'发货区县名称', 'en', N'Dispatcher District Name', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'发货区县编码') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [发货区县编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'发货区县编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'发货区县编码', N'发货区县编码', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'发货区县编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'发货区县编码', 'en', N'Dispatcher District Number', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'采购费用分录') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [采购费用分录] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'采购费用分录')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'采购费用分录', N'采购费用分录', N'文本', N'header', 970, 130, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'采购费用分录' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'采购费用分录', 'en', N'Cost Fee Entity', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'付款信息分录') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [付款信息分录] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'付款信息分录')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'付款信息分录', N'付款信息分录', N'文本', N'header', 970, 130, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'付款信息分录' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'付款信息分录', 'en', N'Payment Entry', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'附件地址') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [附件地址] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'附件地址')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'附件地址', N'附件地址', N'文本', N'header', 970, 130, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'附件地址' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'附件地址', 'en', N'Attachments Url', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'bill_stock_id') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [bill_stock_id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'bill_stock_id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'bill_stock_id', N'bill_stock_id', N'文本', N'header', 970, 130, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'bill_stock_id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'bill_stock_id', 'en', N'Bill Stock Id', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'仓库编码') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [仓库编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'仓库编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'仓库编码', N'仓库编码', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'仓库编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'仓库编码', 'en', N'Bill Stock Number', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'bill_sp_id') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [bill_sp_id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'bill_sp_id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'bill_sp_id', N'bill_sp_id', N'文本', N'header', 970, 130, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'bill_sp_id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'bill_sp_id', 'en', N'Bill Sp Id', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'仓位') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [仓位] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'仓位')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'仓位', N'仓位', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'仓位' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'仓位', 'en', N'Bill Sp Name', 'manual');
IF COL_LENGTH('dbo.bd_purchase_in', N'仓位编码') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [仓位编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'仓位编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'仓位编码', N'仓位编码', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'仓位编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'仓位编码', 'en', N'Bill Sp Number', 'manual');
IF COL_LENGTH('dbo.bl_purchase_in', N'行号') IS NULL ALTER TABLE dbo.bl_purchase_in ADD [行号] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'行号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'行号', N'行号', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'行号' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'行号', 'en', N'Seq', 'manual');
IF COL_LENGTH('dbo.bl_purchase_in', N'商品id') IS NULL ALTER TABLE dbo.bl_purchase_in ADD [商品id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'商品id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'商品id', N'商品id', N'文本', N'detail', 970, 120, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'商品id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'商品id', 'en', N'Material Id', 'manual');
IF COL_LENGTH('dbo.bl_purchase_in', N'商品是否多单位') IS NULL ALTER TABLE dbo.bl_purchase_in ADD [商品是否多单位] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'商品是否多单位')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'商品是否多单位', N'商品是否多单位', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'商品是否多单位' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'商品是否多单位', 'en', N'Material Is Multi Unit', 'manual');
IF COL_LENGTH('dbo.bl_purchase_in', N'商品是否序列号') IS NULL ALTER TABLE dbo.bl_purchase_in ADD [商品是否序列号] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'商品是否序列号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'商品是否序列号', N'商品是否序列号', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'商品是否序列号' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'商品是否序列号', 'en', N'Material Is Serial', 'manual');
IF COL_LENGTH('dbo.bl_purchase_in', N'商品是否辅助属性') IS NULL ALTER TABLE dbo.bl_purchase_in ADD [商品是否辅助属性] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'商品是否辅助属性')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'商品是否辅助属性', N'商品是否辅助属性', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'商品是否辅助属性' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'商品是否辅助属性', 'en', N'Material Is Asst Attr', 'manual');
IF COL_LENGTH('dbo.bl_purchase_in', N'商品是否保质期') IS NULL ALTER TABLE dbo.bl_purchase_in ADD [商品是否保质期] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'商品是否保质期')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'商品是否保质期', N'商品是否保质期', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'商品是否保质期' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'商品是否保质期', 'en', N'Material Is Kf Period', 'manual');
IF COL_LENGTH('dbo.bl_purchase_in', N'商品是否批次') IS NULL ALTER TABLE dbo.bl_purchase_in ADD [商品是否批次] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'商品是否批次')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'商品是否批次', N'商品是否批次', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'商品是否批次' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'商品是否批次', 'en', N'Material Is Batch', 'manual');
IF COL_LENGTH('dbo.bl_purchase_in', N'仓库id') IS NULL ALTER TABLE dbo.bl_purchase_in ADD [仓库id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'仓库id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'仓库id', N'仓库id', N'文本', N'detail', 970, 120, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'仓库id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'仓库id', 'en', N'Stock Id', 'manual');
IF COL_LENGTH('dbo.bl_purchase_in', N'仓库名称') IS NULL ALTER TABLE dbo.bl_purchase_in ADD [仓库名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'仓库名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'仓库名称', N'仓库名称', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'仓库名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'仓库名称', 'en', N'Stock Name', 'manual');
IF COL_LENGTH('dbo.bl_purchase_in', N'仓库编码') IS NULL ALTER TABLE dbo.bl_purchase_in ADD [仓库编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'仓库编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'仓库编码', N'仓库编码', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'仓库编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'仓库编码', 'en', N'Stock Number', 'manual');
IF COL_LENGTH('dbo.bl_purchase_in', N'仓库启用仓位管理') IS NULL ALTER TABLE dbo.bl_purchase_in ADD [仓库启用仓位管理] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'仓库启用仓位管理')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'仓库启用仓位管理', N'仓库启用仓位管理', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'仓库启用仓位管理' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'仓库启用仓位管理', 'en', N'Stock Is Allow Freight', 'manual');
IF COL_LENGTH('dbo.bl_purchase_in', N'仓位id') IS NULL ALTER TABLE dbo.bl_purchase_in ADD [仓位id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'仓位id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'仓位id', N'仓位id', N'文本', N'detail', 970, 120, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'仓位id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'仓位id', 'en', N'Sp Id', 'manual');
IF COL_LENGTH('dbo.bl_purchase_in', N'仓库名称_sp_name') IS NULL ALTER TABLE dbo.bl_purchase_in ADD [仓库名称_sp_name] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'仓库名称_sp_name')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'仓库名称_sp_name', N'仓库名称_sp_name', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'仓库名称_sp_name' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'仓库名称_sp_name', 'en', N'Sp Name', 'manual');
IF COL_LENGTH('dbo.bl_purchase_in', N'仓位编码') IS NULL ALTER TABLE dbo.bl_purchase_in ADD [仓位编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'仓位编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'仓位编码', N'仓位编码', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'仓位编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'仓位编码', 'en', N'Sp Number', 'manual');
IF COL_LENGTH('dbo.bl_purchase_in', N'辅助属性id') IS NULL ALTER TABLE dbo.bl_purchase_in ADD [辅助属性id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'辅助属性id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'辅助属性id', N'辅助属性id', N'文本', N'detail', 970, 120, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助属性id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助属性id', 'en', N'Aux Prop Id', 'manual');
IF COL_LENGTH('dbo.bl_purchase_in', N'辅助属性名称') IS NULL ALTER TABLE dbo.bl_purchase_in ADD [辅助属性名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'辅助属性名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'辅助属性名称', N'辅助属性名称', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助属性名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助属性名称', 'en', N'Aux Prop Name', 'manual');
IF COL_LENGTH('dbo.bl_purchase_in', N'辅助属性编码') IS NULL ALTER TABLE dbo.bl_purchase_in ADD [辅助属性编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'辅助属性编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'辅助属性编码', N'辅助属性编码', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助属性编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助属性编码', 'en', N'Aux Prop Number', 'manual');
IF COL_LENGTH('dbo.bl_purchase_in', N'辅助属性1id') IS NULL ALTER TABLE dbo.bl_purchase_in ADD [辅助属性1id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'辅助属性1id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'辅助属性1id', N'辅助属性1id', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助属性1id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助属性1id', 'en', N'Aux Id1', 'manual');
IF COL_LENGTH('dbo.bl_purchase_in', N'辅助属性1名称') IS NULL ALTER TABLE dbo.bl_purchase_in ADD [辅助属性1名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'辅助属性1名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'辅助属性1名称', N'辅助属性1名称', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助属性1名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助属性1名称', 'en', N'Aux Name1', 'manual');
IF COL_LENGTH('dbo.bl_purchase_in', N'辅助属性1编码') IS NULL ALTER TABLE dbo.bl_purchase_in ADD [辅助属性1编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'辅助属性1编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'辅助属性1编码', N'辅助属性1编码', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助属性1编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助属性1编码', 'en', N'Aux Number1', 'manual');
IF COL_LENGTH('dbo.bl_purchase_in', N'辅助属性2id') IS NULL ALTER TABLE dbo.bl_purchase_in ADD [辅助属性2id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'辅助属性2id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'辅助属性2id', N'辅助属性2id', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助属性2id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助属性2id', 'en', N'Aux Id2', 'manual');
IF COL_LENGTH('dbo.bl_purchase_in', N'辅助属性2名称') IS NULL ALTER TABLE dbo.bl_purchase_in ADD [辅助属性2名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'辅助属性2名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'辅助属性2名称', N'辅助属性2名称', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助属性2名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助属性2名称', 'en', N'Aux Name2', 'manual');
IF COL_LENGTH('dbo.bl_purchase_in', N'辅助属性2编码') IS NULL ALTER TABLE dbo.bl_purchase_in ADD [辅助属性2编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'辅助属性2编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'辅助属性2编码', N'辅助属性2编码', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助属性2编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助属性2编码', 'en', N'Aux Number2', 'manual');
IF COL_LENGTH('dbo.bl_purchase_in', N'辅助属性3id') IS NULL ALTER TABLE dbo.bl_purchase_in ADD [辅助属性3id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'辅助属性3id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'辅助属性3id', N'辅助属性3id', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助属性3id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助属性3id', 'en', N'Aux Id3', 'manual');
IF COL_LENGTH('dbo.bl_purchase_in', N'辅助属性3名称') IS NULL ALTER TABLE dbo.bl_purchase_in ADD [辅助属性3名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'辅助属性3名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'辅助属性3名称', N'辅助属性3名称', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助属性3名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助属性3名称', 'en', N'Aux Name3', 'manual');
IF COL_LENGTH('dbo.bl_purchase_in', N'辅助属性3编码') IS NULL ALTER TABLE dbo.bl_purchase_in ADD [辅助属性3编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'辅助属性3编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'辅助属性3编码', N'辅助属性3编码', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助属性3编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助属性3编码', 'en', N'Aux Number3', 'manual');
IF COL_LENGTH('dbo.bl_purchase_in', N'条形码') IS NULL ALTER TABLE dbo.bl_purchase_in ADD [条形码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'条形码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'条形码', N'条形码', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'条形码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'条形码', 'en', N'Barcode', 'manual');
IF COL_LENGTH('dbo.bl_purchase_in', N'产地') IS NULL ALTER TABLE dbo.bl_purchase_in ADD [产地] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'产地')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'产地', N'产地', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'产地' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'产地', 'en', N'Pro Place', 'manual');
IF COL_LENGTH('dbo.bl_purchase_in', N'注册证号') IS NULL ALTER TABLE dbo.bl_purchase_in ADD [注册证号] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'注册证号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'注册证号', N'注册证号', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'注册证号' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'注册证号', 'en', N'Pro Reg No', 'manual');
IF COL_LENGTH('dbo.bl_purchase_in', N'生产许可证') IS NULL ALTER TABLE dbo.bl_purchase_in ADD [生产许可证] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'生产许可证')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'生产许可证', N'生产许可证', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'生产许可证' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'生产许可证', 'en', N'Pro License', 'manual');
IF COL_LENGTH('dbo.bl_purchase_in', N'保质期到期日') IS NULL ALTER TABLE dbo.bl_purchase_in ADD [保质期到期日] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'保质期到期日')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'保质期到期日', N'保质期到期日', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'保质期到期日' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'保质期到期日', 'en', N'Kf Date', 'manual');
IF COL_LENGTH('dbo.bl_purchase_in', N'有效期至') IS NULL ALTER TABLE dbo.bl_purchase_in ADD [有效期至] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'有效期至')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'有效期至', N'有效期至', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'有效期至' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'有效期至', 'en', N'Valid Date', 'manual');
IF COL_LENGTH('dbo.bl_purchase_in', N'保质期类型') IS NULL ALTER TABLE dbo.bl_purchase_in ADD [保质期类型] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'保质期类型')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'保质期类型', N'保质期类型', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'保质期类型' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'保质期类型', 'en', N'Kf Type', 'manual');
IF COL_LENGTH('dbo.bl_purchase_in', N'保质期') IS NULL ALTER TABLE dbo.bl_purchase_in ADD [保质期] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'保质期')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'保质期', N'保质期', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'保质期' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'保质期', 'en', N'Kf Period', 'manual');
IF COL_LENGTH('dbo.bl_purchase_in', N'序列号清单') IS NULL ALTER TABLE dbo.bl_purchase_in ADD [序列号清单] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'序列号清单')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'序列号清单', N'序列号清单', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'序列号清单' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'序列号清单', 'en', N'Sn List', 'manual');
IF COL_LENGTH('dbo.bl_purchase_in', N'序列号流转ID') IS NULL ALTER TABLE dbo.bl_purchase_in ADD [序列号流转ID] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'序列号流转ID')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'序列号流转ID', N'序列号流转ID', N'文本', N'detail', 970, 120, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'序列号流转ID' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'序列号流转ID', 'en', N'Sn List Id', 'manual');
IF COL_LENGTH('dbo.bl_purchase_in', N'基本单位id') IS NULL ALTER TABLE dbo.bl_purchase_in ADD [基本单位id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'基本单位id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'基本单位id', N'基本单位id', N'文本', N'detail', 970, 120, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'基本单位id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'基本单位id', 'en', N'Base Unit Id', 'manual');
IF COL_LENGTH('dbo.bl_purchase_in', N'基本单位名称') IS NULL ALTER TABLE dbo.bl_purchase_in ADD [基本单位名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'基本单位名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'基本单位名称', N'基本单位名称', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'基本单位名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'基本单位名称', 'en', N'Base Unit Name', 'manual');
IF COL_LENGTH('dbo.bl_purchase_in', N'基本单位编码') IS NULL ALTER TABLE dbo.bl_purchase_in ADD [基本单位编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'基本单位编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'基本单位编码', N'基本单位编码', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'基本单位编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'基本单位编码', 'en', N'Base Unit Number', 'manual');
IF COL_LENGTH('dbo.bl_purchase_in', N'单位id') IS NULL ALTER TABLE dbo.bl_purchase_in ADD [单位id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'单位id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'单位id', N'单位id', N'文本', N'detail', 970, 120, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'单位id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'单位id', 'en', N'Unit Id', 'manual');
IF COL_LENGTH('dbo.bl_purchase_in', N'单位编码') IS NULL ALTER TABLE dbo.bl_purchase_in ADD [单位编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'单位编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'单位编码', N'单位编码', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'单位编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'单位编码', 'en', N'Unit Number', 'manual');
IF COL_LENGTH('dbo.bl_purchase_in', N'辅助单位id') IS NULL ALTER TABLE dbo.bl_purchase_in ADD [辅助单位id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'辅助单位id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'辅助单位id', N'辅助单位id', N'文本', N'detail', 970, 120, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助单位id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助单位id', 'en', N'Aux Unit Id', 'manual');
IF COL_LENGTH('dbo.bl_purchase_in', N'辅助单位编码') IS NULL ALTER TABLE dbo.bl_purchase_in ADD [辅助单位编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'辅助单位编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'辅助单位编码', N'辅助单位编码', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助单位编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助单位编码', 'en', N'Aux Unit Number', 'manual');
IF COL_LENGTH('dbo.bl_purchase_in', N'换算率_conversion_rate') IS NULL ALTER TABLE dbo.bl_purchase_in ADD [换算率_conversion_rate] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'换算率_conversion_rate')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'换算率_conversion_rate', N'换算率_conversion_rate', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'换算率_conversion_rate' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'换算率_conversion_rate', 'en', N'Conversion Rate', 'manual');
IF COL_LENGTH('dbo.bl_purchase_in', N'基本数量') IS NULL ALTER TABLE dbo.bl_purchase_in ADD [基本数量] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'基本数量')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'基本数量', N'基本数量', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'基本数量' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'基本数量', 'en', N'Base Qty', 'manual');
IF COL_LENGTH('dbo.bl_purchase_in', N'库存基本数量') IS NULL ALTER TABLE dbo.bl_purchase_in ADD [库存基本数量] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'库存基本数量')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'库存基本数量', N'库存基本数量', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'库存基本数量' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'库存基本数量', 'en', N'Inv Base Qty', 'manual');
IF COL_LENGTH('dbo.bl_purchase_in', N'默认浮动数量') IS NULL ALTER TABLE dbo.bl_purchase_in ADD [默认浮动数量] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'默认浮动数量')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'默认浮动数量', N'默认浮动数量', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'默认浮动数量' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'默认浮动数量', 'en', N'Def Float Qty', 'manual');
IF COL_LENGTH('dbo.bl_purchase_in', N'辅助换算系数') IS NULL ALTER TABLE dbo.bl_purchase_in ADD [辅助换算系数] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'辅助换算系数')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'辅助换算系数', N'辅助换算系数', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助换算系数' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助换算系数', 'en', N'Aux Coefficient', 'manual');
IF COL_LENGTH('dbo.bl_purchase_in', N'换算系数') IS NULL ALTER TABLE dbo.bl_purchase_in ADD [换算系数] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'换算系数')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'换算系数', N'换算系数', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'换算系数' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'换算系数', 'en', N'Coefficient', 'manual');
IF COL_LENGTH('dbo.bl_purchase_in', N'折扣额') IS NULL ALTER TABLE dbo.bl_purchase_in ADD [折扣额] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'折扣额')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'折扣额', N'折扣额', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'折扣额' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'折扣额', 'en', N'Discount', 'manual');
IF COL_LENGTH('dbo.bl_purchase_in', N'源单编号') IS NULL ALTER TABLE dbo.bl_purchase_in ADD [源单编号] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'源单编号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'源单编号', N'源单编号', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'源单编号' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'源单编号', 'en', N'Src Bill No', 'manual');
IF COL_LENGTH('dbo.bl_purchase_in', N'源单类型id') IS NULL ALTER TABLE dbo.bl_purchase_in ADD [源单类型id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'源单类型id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'源单类型id', N'源单类型id', N'文本', N'detail', 970, 120, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'源单类型id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'源单类型id', 'en', N'Src Bill Type Id', 'manual');
IF COL_LENGTH('dbo.bl_purchase_in', N'源单类型名称') IS NULL ALTER TABLE dbo.bl_purchase_in ADD [源单类型名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'源单类型名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'源单类型名称', N'源单类型名称', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'源单类型名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'源单类型名称', 'en', N'Src Bill Type Name', 'manual');
IF COL_LENGTH('dbo.bl_purchase_in', N'源单类型编码') IS NULL ALTER TABLE dbo.bl_purchase_in ADD [源单类型编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'源单类型编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'源单类型编码', N'源单类型编码', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'源单类型编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'源单类型编码', 'en', N'Src Bill Type Number', 'manual');
IF COL_LENGTH('dbo.bl_purchase_in', N'源单内部id') IS NULL ALTER TABLE dbo.bl_purchase_in ADD [源单内部id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'源单内部id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'源单内部id', N'源单内部id', N'文本', N'detail', 970, 120, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'源单内部id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'源单内部id', 'en', N'Src Inter Id', 'manual');
IF COL_LENGTH('dbo.bl_purchase_in', N'源单日期') IS NULL ALTER TABLE dbo.bl_purchase_in ADD [源单日期] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'源单日期')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'源单日期', N'源单日期', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'源单日期' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'源单日期', 'en', N'Src Bill Date', 'manual');
IF COL_LENGTH('dbo.bl_purchase_in', N'源单行号') IS NULL ALTER TABLE dbo.bl_purchase_in ADD [源单行号] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'源单行号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'源单行号', N'源单行号', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'源单行号' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'源单行号', 'en', N'Src Seq', 'manual');
IF COL_LENGTH('dbo.bl_purchase_in', N'源单分录id') IS NULL ALTER TABLE dbo.bl_purchase_in ADD [源单分录id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'源单分录id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'源单分录id', N'源单分录id', N'文本', N'detail', 970, 120, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'源单分录id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'源单分录id', 'en', N'Src Entry Id', 'manual');
IF COL_LENGTH('dbo.bl_purchase_in', N'分录结算状态') IS NULL ALTER TABLE dbo.bl_purchase_in ADD [分录结算状态] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'分录结算状态')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'分录结算状态', N'分录结算状态', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'分录结算状态' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'分录结算状态', 'en', N'Entry Settle Status', 'manual');
IF COL_LENGTH('dbo.bl_purchase_in', N'cur_settle_amount_for') IS NULL ALTER TABLE dbo.bl_purchase_in ADD [cur_settle_amount_for] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'cur_settle_amount_for')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'cur_settle_amount_for', N'cur_settle_amount_for', N'文本', N'detail', 970, 120, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'cur_settle_amount_for' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'cur_settle_amount_for', 'en', N'Cur Settle Amount For', 'manual');
IF COL_LENGTH('dbo.bl_purchase_in', N'折扣率%') IS NULL ALTER TABLE dbo.bl_purchase_in ADD [折扣率%] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'折扣率%')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'折扣率%', N'折扣率%', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'折扣率%' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'折扣率%', 'en', N'Dis Rate', 'manual');
IF COL_LENGTH('dbo.bl_purchase_in', N'成本视图') IS NULL ALTER TABLE dbo.bl_purchase_in ADD [成本视图] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'成本视图')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'成本视图', N'成本视图', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'成本视图' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'成本视图', 'en', N'Cost View', 'manual');
IF COL_LENGTH('dbo.bl_purchase_in', N'单位成本视图') IS NULL ALTER TABLE dbo.bl_purchase_in ADD [单位成本视图] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'单位成本视图')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'单位成本视图', N'单位成本视图', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'单位成本视图' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'单位成本视图', 'en', N'Unit Cost View', 'manual');
IF COL_LENGTH('dbo.bl_purchase_in', N'退货数量') IS NULL ALTER TABLE dbo.bl_purchase_in ADD [退货数量] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'退货数量')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'退货数量', N'退货数量', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'退货数量' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'退货数量', 'en', N'Return Qty', 'manual');
IF COL_LENGTH('dbo.bl_purchase_in', N'价税合计本位币') IS NULL ALTER TABLE dbo.bl_purchase_in ADD [价税合计本位币] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'价税合计本位币')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'价税合计本位币', N'价税合计本位币', N'文本', N'detail', 970, 120, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'价税合计本位币' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'价税合计本位币', 'en', N'All Amount For', 'manual');
IF COL_LENGTH('dbo.bl_purchase_in', N'是否赠品') IS NULL ALTER TABLE dbo.bl_purchase_in ADD [是否赠品] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'是否赠品')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'是否赠品', N'是否赠品', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'是否赠品' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'是否赠品', 'en', N'Is Free', 'manual');
GO

-- ══ SALE_OUT(SALE_OUT):头补 87 行补 89 ══
IF COL_LENGTH('dbo.bd_sale_out', N'创建时间') IS NULL ALTER TABLE dbo.bd_sale_out ADD [创建时间] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'创建时间')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'创建时间', N'创建时间', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'创建时间' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'创建时间', 'en', N'Create Time', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'单据状态_bill_status') IS NULL ALTER TABLE dbo.bd_sale_out ADD [单据状态_bill_status] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'单据状态_bill_status')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'单据状态_bill_status', N'单据状态_bill_status', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'单据状态_bill_status' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'单据状态_bill_status', 'en', N'Bill Status', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'结算状态') IS NULL ALTER TABLE dbo.bd_sale_out ADD [结算状态] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'结算状态')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'结算状态', N'结算状态', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'结算状态' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'结算状态', 'en', N'Settle Status', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'发货状态') IS NULL ALTER TABLE dbo.bd_sale_out ADD [发货状态] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'发货状态')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'发货状态', N'发货状态', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'发货状态' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'发货状态', 'en', N'Delivery Status', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'customer_id') IS NULL ALTER TABLE dbo.bd_sale_out ADD [customer_id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'customer_id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'customer_id', N'customer_id', N'文本', N'header', 970, 130, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'customer_id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'customer_id', 'en', N'Customer Id', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'emp_id') IS NULL ALTER TABLE dbo.bd_sale_out ADD [emp_id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'emp_id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'emp_id', N'emp_id', N'文本', N'header', 970, 130, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'emp_id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'emp_id', 'en', N'Emp Id', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'经手人编码') IS NULL ALTER TABLE dbo.bd_sale_out ADD [经手人编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'经手人编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'经手人编码', N'经手人编码', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'经手人编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'经手人编码', 'en', N'Emp Number', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'金额') IS NULL ALTER TABLE dbo.bd_sale_out ADD [金额] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'金额')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'金额', N'金额', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'金额' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'金额', 'en', N'Total Amount', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'商品组合') IS NULL ALTER TABLE dbo.bd_sale_out ADD [商品组合] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'商品组合')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'商品组合', N'商品组合', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'商品组合' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'商品组合', 'en', N'Material Group', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'商品数量') IS NULL ALTER TABLE dbo.bd_sale_out ADD [商品数量] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'商品数量')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'商品数量', N'商品数量', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'商品数量' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'商品数量', 'en', N'Material Qty', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'折前价税合计') IS NULL ALTER TABLE dbo.bd_sale_out ADD [折前价税合计] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'折前价税合计')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'折前价税合计', N'折前价税合计', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'折前价税合计' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'折前价税合计', 'en', N'Bill Dis Before Amount', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'整单折扣额') IS NULL ALTER TABLE dbo.bd_sale_out ADD [整单折扣额] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'整单折扣额')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'整单折扣额', N'整单折扣额', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'整单折扣额' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'整单折扣额', 'en', N'Bill Dis Amount', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'商品分录') IS NULL ALTER TABLE dbo.bd_sale_out ADD [商品分录] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'商品分录')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'商品分录', N'商品分录', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'商品分录' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'商品分录', 'en', N'Material Entity', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'物流信息分录') IS NULL ALTER TABLE dbo.bd_sale_out ADD [物流信息分录] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'物流信息分录')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'物流信息分录', N'物流信息分录', N'文本', N'header', 970, 130, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'物流信息分录' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'物流信息分录', 'en', N'Express Entity', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'ivc_status ') IS NULL ALTER TABLE dbo.bd_sale_out ADD [ivc_status ] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'ivc_status ')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'ivc_status ', N'ivc_status ', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'ivc_status ' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'ivc_status ', 'en', N'Ivc Status ', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'联系人电话') IS NULL ALTER TABLE dbo.bd_sale_out ADD [联系人电话] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'联系人电话')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'联系人电话', N'联系人电话', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'联系人电话' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'联系人电话', 'en', N'Contact Phone', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'contact_country_id') IS NULL ALTER TABLE dbo.bd_sale_out ADD [contact_country_id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'contact_country_id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'contact_country_id', N'contact_country_id', N'文本', N'header', 970, 130, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'contact_country_id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'contact_country_id', 'en', N'Contact Country Id', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'联系人国家名称') IS NULL ALTER TABLE dbo.bd_sale_out ADD [联系人国家名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'联系人国家名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'联系人国家名称', N'联系人国家名称', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'联系人国家名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'联系人国家名称', 'en', N'Contact Country Name', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'联系人国家编码') IS NULL ALTER TABLE dbo.bd_sale_out ADD [联系人国家编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'联系人国家编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'联系人国家编码', N'联系人国家编码', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'联系人国家编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'联系人国家编码', 'en', N'Contact Country Number', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'contact_province_id') IS NULL ALTER TABLE dbo.bd_sale_out ADD [contact_province_id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'contact_province_id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'contact_province_id', N'contact_province_id', N'文本', N'header', 970, 130, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'contact_province_id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'contact_province_id', 'en', N'Contact Province Id', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'联系人省份名称') IS NULL ALTER TABLE dbo.bd_sale_out ADD [联系人省份名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'联系人省份名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'联系人省份名称', N'联系人省份名称', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'联系人省份名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'联系人省份名称', 'en', N'Contact Province Name', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'联系人省份编码') IS NULL ALTER TABLE dbo.bd_sale_out ADD [联系人省份编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'联系人省份编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'联系人省份编码', N'联系人省份编码', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'联系人省份编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'联系人省份编码', 'en', N'Contact Province Number', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'contact_city_id') IS NULL ALTER TABLE dbo.bd_sale_out ADD [contact_city_id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'contact_city_id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'contact_city_id', N'contact_city_id', N'文本', N'header', 970, 130, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'contact_city_id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'contact_city_id', 'en', N'Contact City Id', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'联系人市区名称') IS NULL ALTER TABLE dbo.bd_sale_out ADD [联系人市区名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'联系人市区名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'联系人市区名称', N'联系人市区名称', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'联系人市区名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'联系人市区名称', 'en', N'Contact City Name', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'联系人市区编码') IS NULL ALTER TABLE dbo.bd_sale_out ADD [联系人市区编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'联系人市区编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'联系人市区编码', N'联系人市区编码', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'联系人市区编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'联系人市区编码', 'en', N'Contact City Number', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'contact_district_id') IS NULL ALTER TABLE dbo.bd_sale_out ADD [contact_district_id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'contact_district_id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'contact_district_id', N'contact_district_id', N'文本', N'header', 970, 130, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'contact_district_id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'contact_district_id', 'en', N'Contact District Id', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'联系人区县名称') IS NULL ALTER TABLE dbo.bd_sale_out ADD [联系人区县名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'联系人区县名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'联系人区县名称', N'联系人区县名称', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'联系人区县名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'联系人区县名称', 'en', N'Contact District Name', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'联系人区县编码') IS NULL ALTER TABLE dbo.bd_sale_out ADD [联系人区县编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'联系人区县编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'联系人区县编码', N'联系人区县编码', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'联系人区县编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'联系人区县编码', 'en', N'Contact District Number', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'联系人') IS NULL ALTER TABLE dbo.bd_sale_out ADD [联系人] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'联系人')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'联系人', N'联系人', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'联系人' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'联系人', 'en', N'Contact Linkman', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'联系信息') IS NULL ALTER TABLE dbo.bd_sale_out ADD [联系信息] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'联系信息')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'联系信息', N'联系信息', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'联系信息' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'联系信息', 'en', N'Contact Info', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'联系地址') IS NULL ALTER TABLE dbo.bd_sale_out ADD [联系地址] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'联系地址')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'联系地址', N'联系地址', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'联系地址' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'联系地址', 'en', N'Contact Address', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'dispatcher_country_id') IS NULL ALTER TABLE dbo.bd_sale_out ADD [dispatcher_country_id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'dispatcher_country_id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'dispatcher_country_id', N'dispatcher_country_id', N'文本', N'header', 970, 130, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'dispatcher_country_id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'dispatcher_country_id', 'en', N'Dispatcher Country Id', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'发货国家名称') IS NULL ALTER TABLE dbo.bd_sale_out ADD [发货国家名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'发货国家名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'发货国家名称', N'发货国家名称', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'发货国家名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'发货国家名称', 'en', N'Dispatcher Country Name', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'发货国家编码') IS NULL ALTER TABLE dbo.bd_sale_out ADD [发货国家编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'发货国家编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'发货国家编码', N'发货国家编码', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'发货国家编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'发货国家编码', 'en', N'Dispatcher Country Number', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'dispatcher_province_id') IS NULL ALTER TABLE dbo.bd_sale_out ADD [dispatcher_province_id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'dispatcher_province_id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'dispatcher_province_id', N'dispatcher_province_id', N'文本', N'header', 970, 130, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'dispatcher_province_id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'dispatcher_province_id', 'en', N'Dispatcher Province Id', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'发货省份名称') IS NULL ALTER TABLE dbo.bd_sale_out ADD [发货省份名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'发货省份名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'发货省份名称', N'发货省份名称', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'发货省份名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'发货省份名称', 'en', N'Dispatcher Province Name', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'发货省份编码') IS NULL ALTER TABLE dbo.bd_sale_out ADD [发货省份编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'发货省份编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'发货省份编码', N'发货省份编码', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'发货省份编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'发货省份编码', 'en', N'Dispatcher Province Number', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'dispatcher_city_id') IS NULL ALTER TABLE dbo.bd_sale_out ADD [dispatcher_city_id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'dispatcher_city_id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'dispatcher_city_id', N'dispatcher_city_id', N'文本', N'header', 970, 130, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'dispatcher_city_id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'dispatcher_city_id', 'en', N'Dispatcher City Id', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'发货市区名称') IS NULL ALTER TABLE dbo.bd_sale_out ADD [发货市区名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'发货市区名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'发货市区名称', N'发货市区名称', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'发货市区名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'发货市区名称', 'en', N'Dispatcher City Name', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'发货市区编码') IS NULL ALTER TABLE dbo.bd_sale_out ADD [发货市区编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'发货市区编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'发货市区编码', N'发货市区编码', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'发货市区编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'发货市区编码', 'en', N'Dispatcher City Number', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'dispatcher_district_id') IS NULL ALTER TABLE dbo.bd_sale_out ADD [dispatcher_district_id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'dispatcher_district_id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'dispatcher_district_id', N'dispatcher_district_id', N'文本', N'header', 970, 130, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'dispatcher_district_id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'dispatcher_district_id', 'en', N'Dispatcher District Id', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'发货区县名称') IS NULL ALTER TABLE dbo.bd_sale_out ADD [发货区县名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'发货区县名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'发货区县名称', N'发货区县名称', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'发货区县名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'发货区县名称', 'en', N'Dispatcher District Name', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'发货区县编码') IS NULL ALTER TABLE dbo.bd_sale_out ADD [发货区县编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'发货区县编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'发货区县编码', N'发货区县编码', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'发货区县编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'发货区县编码', 'en', N'Dispatcher District Number', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'发货地址') IS NULL ALTER TABLE dbo.bd_sale_out ADD [发货地址] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'发货地址')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'发货地址', N'发货地址', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'发货地址' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'发货地址', 'en', N'Dispatcher Address', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'发货人_dispatcher_linkman') IS NULL ALTER TABLE dbo.bd_sale_out ADD [发货人_dispatcher_linkman] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'发货人_dispatcher_linkman')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'发货人_dispatcher_linkman', N'发货人_dispatcher_linkman', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'发货人_dispatcher_linkman' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'发货人_dispatcher_linkman', 'en', N'Dispatcher Linkman', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'发货电话') IS NULL ALTER TABLE dbo.bd_sale_out ADD [发货电话] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'发货电话')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'发货电话', N'发货电话', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'发货电话' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'发货电话', 'en', N'Dispatcher Phone', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'发货方式') IS NULL ALTER TABLE dbo.bd_sale_out ADD [发货方式] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'发货方式')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'发货方式', N'发货方式', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'发货方式' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'发货方式', 'en', N'Recevice Delivery', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'付款信息分录') IS NULL ALTER TABLE dbo.bd_sale_out ADD [付款信息分录] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'付款信息分录')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'付款信息分录', N'付款信息分录', N'文本', N'header', 970, 130, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'付款信息分录' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'付款信息分录', 'en', N'Payment Entry', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'抵扣余额') IS NULL ALTER TABLE dbo.bd_sale_out ADD [抵扣余额] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'抵扣余额')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'抵扣余额', N'抵扣余额', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'抵扣余额' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'抵扣余额', 'en', N'Deduction Balance', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'未结算金额') IS NULL ALTER TABLE dbo.bd_sale_out ADD [未结算金额] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'未结算金额')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'未结算金额', N'未结算金额', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'未结算金额' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'未结算金额', 'en', N'Total Un Settle Amount', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'attachments') IS NULL ALTER TABLE dbo.bd_sale_out ADD [attachments] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'attachments')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'attachments', N'attachments', N'文本', N'header', 970, 130, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'attachments' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'attachments', 'en', N'Attachments', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'附件地址') IS NULL ALTER TABLE dbo.bd_sale_out ADD [附件地址] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'附件地址')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'附件地址', N'附件地址', N'文本', N'header', 970, 130, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'附件地址' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'附件地址', 'en', N'Attachments Url', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'auditor_id') IS NULL ALTER TABLE dbo.bd_sale_out ADD [auditor_id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'auditor_id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'auditor_id', N'auditor_id', N'文本', N'header', 970, 130, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'auditor_id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'auditor_id', 'en', N'Auditor Id', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'审核人_auditor_name') IS NULL ALTER TABLE dbo.bd_sale_out ADD [审核人_auditor_name] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'审核人_auditor_name')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'审核人_auditor_name', N'审核人_auditor_name', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'审核人_auditor_name' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'审核人_auditor_name', 'en', N'Auditor Name', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'auditor_number') IS NULL ALTER TABLE dbo.bd_sale_out ADD [auditor_number] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'auditor_number')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'auditor_number', N'auditor_number', N'文本', N'header', 970, 130, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'auditor_number' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'auditor_number', 'en', N'Auditor Number', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'审核时间_audit_time') IS NULL ALTER TABLE dbo.bd_sale_out ADD [审核时间_audit_time] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'审核时间_audit_time')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'审核时间_audit_time', N'审核时间_audit_time', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'审核时间_audit_time' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'审核时间_audit_time', 'en', N'Audit Time', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'应收款余额') IS NULL ALTER TABLE dbo.bd_sale_out ADD [应收款余额] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'应收款余额')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'应收款余额', N'应收款余额', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'应收款余额' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'应收款余额', 'en', N'All Debt', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'f_logistics_id') IS NULL ALTER TABLE dbo.bd_sale_out ADD [f_logistics_id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'f_logistics_id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'f_logistics_id', N'f_logistics_id', N'文本', N'header', 970, 130, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'f_logistics_id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'f_logistics_id', 'en', N'F Logistics Id', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'采购费用') IS NULL ALTER TABLE dbo.bd_sale_out ADD [采购费用] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'采购费用')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'采购费用', N'采购费用', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'采购费用' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'采购费用', 'en', N'Cost Fee', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'费用分摊信息') IS NULL ALTER TABLE dbo.bd_sale_out ADD [费用分摊信息] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'费用分摊信息')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'费用分摊信息', N'费用分摊信息', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'费用分摊信息' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'费用分摊信息', 'en', N'Subsist Info', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'上次欠款') IS NULL ALTER TABLE dbo.bd_sale_out ADD [上次欠款] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'上次欠款')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'上次欠款', N'上次欠款', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'上次欠款' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'上次欠款', 'en', N'Last Debt', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'交易类型') IS NULL ALTER TABLE dbo.bd_sale_out ADD [交易类型] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'交易类型')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'交易类型', N'交易类型', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'交易类型' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'交易类型', 'en', N'Trans Type', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'dept_id') IS NULL ALTER TABLE dbo.bd_sale_out ADD [dept_id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'dept_id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'dept_id', N'dept_id', N'文本', N'header', 970, 130, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'dept_id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'dept_id', 'en', N'Dept Id', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'部门_dept_name') IS NULL ALTER TABLE dbo.bd_sale_out ADD [部门_dept_name] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'部门_dept_name')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'部门_dept_name', N'部门_dept_name', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'部门_dept_name' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'部门_dept_name', 'en', N'Dept Name', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'部门编码') IS NULL ALTER TABLE dbo.bd_sale_out ADD [部门编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'部门编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'部门编码', N'部门编码', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'部门编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'部门编码', 'en', N'Dept Number', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'整单折扣率%') IS NULL ALTER TABLE dbo.bd_sale_out ADD [整单折扣率%] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'整单折扣率%')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'整单折扣率%', N'整单折扣率%', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'整单折扣率%' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'整单折扣率%', 'en', N'Bill Dis Rate', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'修改时间') IS NULL ALTER TABLE dbo.bd_sale_out ADD [修改时间] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'修改时间')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'修改时间', N'修改时间', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'修改时间' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'修改时间', 'en', N'Modify Time', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'出入库状态') IS NULL ALTER TABLE dbo.bd_sale_out ADD [出入库状态] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'出入库状态')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'出入库状态', N'出入库状态', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'出入库状态' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'出入库状态', 'en', N'Io Status', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'creator_id') IS NULL ALTER TABLE dbo.bd_sale_out ADD [creator_id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'creator_id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'creator_id', N'creator_id', N'文本', N'header', 970, 130, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'creator_id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'creator_id', 'en', N'Creator Id', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'创建人') IS NULL ALTER TABLE dbo.bd_sale_out ADD [创建人] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'创建人')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'创建人', N'创建人', N'文本', N'header', 970, 130, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'创建人' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'创建人', 'en', N'Creator Name', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'creator_number') IS NULL ALTER TABLE dbo.bd_sale_out ADD [creator_number] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'creator_number')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'creator_number', N'creator_number', N'文本', N'header', 970, 130, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'creator_number' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'creator_number', 'en', N'Creator Number', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'modifier_id') IS NULL ALTER TABLE dbo.bd_sale_out ADD [modifier_id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'modifier_id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'modifier_id', N'modifier_id', N'文本', N'header', 970, 130, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'modifier_id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'modifier_id', 'en', N'Modifier Id', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'修改人') IS NULL ALTER TABLE dbo.bd_sale_out ADD [修改人] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'修改人')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'修改人', N'修改人', N'文本', N'header', 970, 130, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'修改人' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'修改人', 'en', N'Modifier Name', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'modifier_number') IS NULL ALTER TABLE dbo.bd_sale_out ADD [modifier_number] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'modifier_number')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'modifier_number', N'modifier_number', N'文本', N'header', 970, 130, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'modifier_number' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'modifier_number', 'en', N'Modifier Number', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'单据标签') IS NULL ALTER TABLE dbo.bd_sale_out ADD [单据标签] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'单据标签')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'单据标签', N'单据标签', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'单据标签' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'单据标签', 'en', N'Mulbill Label', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'客户承担费用分录') IS NULL ALTER TABLE dbo.bd_sale_out ADD [客户承担费用分录] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'客户承担费用分录')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'客户承担费用分录', N'客户承担费用分录', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'客户承担费用分录' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'客户承担费用分录', 'en', N'Cus Bear Fee Entry', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'delivery_type_id') IS NULL ALTER TABLE dbo.bd_sale_out ADD [delivery_type_id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'delivery_type_id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'delivery_type_id', N'delivery_type_id', N'文本', N'header', 970, 130, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'delivery_type_id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'delivery_type_id', 'en', N'Delivery Type Id', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'交货方式') IS NULL ALTER TABLE dbo.bd_sale_out ADD [交货方式] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'交货方式')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'交货方式', N'交货方式', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'交货方式' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'交货方式', 'en', N'Delivery Type Name', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'交货方式编码') IS NULL ALTER TABLE dbo.bd_sale_out ADD [交货方式编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'交货方式编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'交货方式编码', N'交货方式编码', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'交货方式编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'交货方式编码', 'en', N'Delivery Type Number', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'币种id') IS NULL ALTER TABLE dbo.bd_sale_out ADD [币种id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'币种id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'币种id', N'币种id', N'文本', N'header', 970, 130, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'币种id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'币种id', 'en', N'Currency Id', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'到期日') IS NULL ALTER TABLE dbo.bd_sale_out ADD [到期日] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'到期日')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'到期日', N'到期日', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'到期日' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'到期日', 'en', N'Due Date', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'setting_term_id') IS NULL ALTER TABLE dbo.bd_sale_out ADD [setting_term_id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'setting_term_id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'setting_term_id', N'setting_term_id', N'文本', N'header', 970, 130, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'setting_term_id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'setting_term_id', 'en', N'Setting Term Id', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'结算期限编码') IS NULL ALTER TABLE dbo.bd_sale_out ADD [结算期限编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'结算期限编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'结算期限编码', N'结算期限编码', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'结算期限编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'结算期限编码', 'en', N'Setting Term Number', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'结算期限') IS NULL ALTER TABLE dbo.bd_sale_out ADD [结算期限] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'结算期限')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'结算期限', N'结算期限', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'结算期限' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'结算期限', 'en', N'Setting Term Name', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'配送路线分录') IS NULL ALTER TABLE dbo.bd_sale_out ADD [配送路线分录] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'配送路线分录')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'配送路线分录', N'配送路线分录', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'配送路线分录' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'配送路线分录', 'en', N'Vrp Entity', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'采购费用分录') IS NULL ALTER TABLE dbo.bd_sale_out ADD [采购费用分录] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'采购费用分录')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'采购费用分录', N'采购费用分录', N'文本', N'header', 970, 130, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'采购费用分录' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'采购费用分录', 'en', N'Cost Fee Entity', 'manual');
IF COL_LENGTH('dbo.bd_sale_out', N'币别名称') IS NULL ALTER TABLE dbo.bd_sale_out ADD [币别名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'币别名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'币别名称', N'币别名称', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'币别名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'币别名称', 'en', N'Currency Name', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'商品id') IS NULL ALTER TABLE dbo.bl_sale_out ADD [商品id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'商品id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'商品id', N'商品id', N'文本', N'detail', 970, 120, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'商品id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'商品id', 'en', N'Material Id', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'商品是否多单位') IS NULL ALTER TABLE dbo.bl_sale_out ADD [商品是否多单位] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'商品是否多单位')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'商品是否多单位', N'商品是否多单位', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'商品是否多单位' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'商品是否多单位', 'en', N'Material Is Multi Unit', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'商品是否序列号') IS NULL ALTER TABLE dbo.bl_sale_out ADD [商品是否序列号] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'商品是否序列号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'商品是否序列号', N'商品是否序列号', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'商品是否序列号' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'商品是否序列号', 'en', N'Material Is Serial', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'商品是否辅助属性') IS NULL ALTER TABLE dbo.bl_sale_out ADD [商品是否辅助属性] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'商品是否辅助属性')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'商品是否辅助属性', N'商品是否辅助属性', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'商品是否辅助属性' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'商品是否辅助属性', 'en', N'Material Is Asst Attr', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'商品是否保质期') IS NULL ALTER TABLE dbo.bl_sale_out ADD [商品是否保质期] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'商品是否保质期')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'商品是否保质期', N'商品是否保质期', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'商品是否保质期' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'商品是否保质期', 'en', N'Material Is Kf Period', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'商品是否批次') IS NULL ALTER TABLE dbo.bl_sale_out ADD [商品是否批次] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'商品是否批次')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'商品是否批次', N'商品是否批次', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'商品是否批次' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'商品是否批次', 'en', N'Material Is Batch', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'商品助记码') IS NULL ALTER TABLE dbo.bl_sale_out ADD [商品助记码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'商品助记码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'商品助记码', N'商品助记码', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'商品助记码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'商品助记码', 'en', N'Material Help Code', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'仓库id') IS NULL ALTER TABLE dbo.bl_sale_out ADD [仓库id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'仓库id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'仓库id', N'仓库id', N'文本', N'detail', 970, 120, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'仓库id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'仓库id', 'en', N'Stock Id', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'仓库名称') IS NULL ALTER TABLE dbo.bl_sale_out ADD [仓库名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'仓库名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'仓库名称', N'仓库名称', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'仓库名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'仓库名称', 'en', N'Stock Name', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'仓库编码') IS NULL ALTER TABLE dbo.bl_sale_out ADD [仓库编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'仓库编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'仓库编码', N'仓库编码', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'仓库编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'仓库编码', 'en', N'Stock Number', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'仓库启用仓位管理') IS NULL ALTER TABLE dbo.bl_sale_out ADD [仓库启用仓位管理] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'仓库启用仓位管理')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'仓库启用仓位管理', N'仓库启用仓位管理', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'仓库启用仓位管理' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'仓库启用仓位管理', 'en', N'Stock Is Allow Freight', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'仓位id') IS NULL ALTER TABLE dbo.bl_sale_out ADD [仓位id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'仓位id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'仓位id', N'仓位id', N'文本', N'detail', 970, 120, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'仓位id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'仓位id', 'en', N'Sp Id', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'仓库名称_sp_name') IS NULL ALTER TABLE dbo.bl_sale_out ADD [仓库名称_sp_name] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'仓库名称_sp_name')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'仓库名称_sp_name', N'仓库名称_sp_name', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'仓库名称_sp_name' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'仓库名称_sp_name', 'en', N'Sp Name', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'仓位编码') IS NULL ALTER TABLE dbo.bl_sale_out ADD [仓位编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'仓位编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'仓位编码', N'仓位编码', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'仓位编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'仓位编码', 'en', N'Sp Number', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'辅助属性id') IS NULL ALTER TABLE dbo.bl_sale_out ADD [辅助属性id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'辅助属性id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'辅助属性id', N'辅助属性id', N'文本', N'detail', 970, 120, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助属性id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助属性id', 'en', N'Aux Prop Id', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'辅助属性名称') IS NULL ALTER TABLE dbo.bl_sale_out ADD [辅助属性名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'辅助属性名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'辅助属性名称', N'辅助属性名称', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助属性名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助属性名称', 'en', N'Aux Prop Name', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'辅助属性编码') IS NULL ALTER TABLE dbo.bl_sale_out ADD [辅助属性编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'辅助属性编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'辅助属性编码', N'辅助属性编码', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助属性编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助属性编码', 'en', N'Aux Prop Number', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'辅助属性1id') IS NULL ALTER TABLE dbo.bl_sale_out ADD [辅助属性1id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'辅助属性1id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'辅助属性1id', N'辅助属性1id', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助属性1id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助属性1id', 'en', N'Aux Id1', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'辅助属性1名称') IS NULL ALTER TABLE dbo.bl_sale_out ADD [辅助属性1名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'辅助属性1名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'辅助属性1名称', N'辅助属性1名称', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助属性1名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助属性1名称', 'en', N'Aux Name1', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'辅助属性1编码') IS NULL ALTER TABLE dbo.bl_sale_out ADD [辅助属性1编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'辅助属性1编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'辅助属性1编码', N'辅助属性1编码', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助属性1编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助属性1编码', 'en', N'Aux Number1', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'辅助属性2id') IS NULL ALTER TABLE dbo.bl_sale_out ADD [辅助属性2id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'辅助属性2id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'辅助属性2id', N'辅助属性2id', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助属性2id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助属性2id', 'en', N'Aux Id2', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'辅助属性2名称') IS NULL ALTER TABLE dbo.bl_sale_out ADD [辅助属性2名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'辅助属性2名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'辅助属性2名称', N'辅助属性2名称', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助属性2名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助属性2名称', 'en', N'Aux Name2', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'辅助属性2编码') IS NULL ALTER TABLE dbo.bl_sale_out ADD [辅助属性2编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'辅助属性2编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'辅助属性2编码', N'辅助属性2编码', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助属性2编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助属性2编码', 'en', N'Aux Number2', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'辅助属性3id') IS NULL ALTER TABLE dbo.bl_sale_out ADD [辅助属性3id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'辅助属性3id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'辅助属性3id', N'辅助属性3id', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助属性3id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助属性3id', 'en', N'Aux Id3', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'辅助属性3名称') IS NULL ALTER TABLE dbo.bl_sale_out ADD [辅助属性3名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'辅助属性3名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'辅助属性3名称', N'辅助属性3名称', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助属性3名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助属性3名称', 'en', N'Aux Name3', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'辅助属性3编码') IS NULL ALTER TABLE dbo.bl_sale_out ADD [辅助属性3编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'辅助属性3编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'辅助属性3编码', N'辅助属性3编码', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助属性3编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助属性3编码', 'en', N'Aux Number3', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'辅助属性4id') IS NULL ALTER TABLE dbo.bl_sale_out ADD [辅助属性4id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'辅助属性4id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'辅助属性4id', N'辅助属性4id', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助属性4id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助属性4id', 'en', N'Aux Id4', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'辅助属性4名称') IS NULL ALTER TABLE dbo.bl_sale_out ADD [辅助属性4名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'辅助属性4名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'辅助属性4名称', N'辅助属性4名称', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助属性4名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助属性4名称', 'en', N'Aux Name4', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'辅助属性4编码') IS NULL ALTER TABLE dbo.bl_sale_out ADD [辅助属性4编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'辅助属性4编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'辅助属性4编码', N'辅助属性4编码', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助属性4编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助属性4编码', 'en', N'Aux Number4', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'辅助属性5id') IS NULL ALTER TABLE dbo.bl_sale_out ADD [辅助属性5id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'辅助属性5id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'辅助属性5id', N'辅助属性5id', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助属性5id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助属性5id', 'en', N'Aux Id5', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'辅助属性5名称') IS NULL ALTER TABLE dbo.bl_sale_out ADD [辅助属性5名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'辅助属性5名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'辅助属性5名称', N'辅助属性5名称', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助属性5名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助属性5名称', 'en', N'Aux Name5', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'辅助属性5编码') IS NULL ALTER TABLE dbo.bl_sale_out ADD [辅助属性5编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'辅助属性5编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'辅助属性5编码', N'辅助属性5编码', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助属性5编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助属性5编码', 'en', N'Aux Number5', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'条形码') IS NULL ALTER TABLE dbo.bl_sale_out ADD [条形码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'条形码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'条形码', N'条形码', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'条形码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'条形码', 'en', N'Barcode', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'实际含税单价') IS NULL ALTER TABLE dbo.bl_sale_out ADD [实际含税单价] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'实际含税单价')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'实际含税单价', N'实际含税单价', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'实际含税单价' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'实际含税单价', 'en', N'Act Tax Price', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'基本单位id') IS NULL ALTER TABLE dbo.bl_sale_out ADD [基本单位id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'基本单位id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'基本单位id', N'基本单位id', N'文本', N'detail', 970, 120, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'基本单位id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'基本单位id', 'en', N'Base Unit Id', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'基本单位名称') IS NULL ALTER TABLE dbo.bl_sale_out ADD [基本单位名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'基本单位名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'基本单位名称', N'基本单位名称', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'基本单位名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'基本单位名称', 'en', N'Base Unit Name', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'基本单位编码') IS NULL ALTER TABLE dbo.bl_sale_out ADD [基本单位编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'基本单位编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'基本单位编码', N'基本单位编码', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'基本单位编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'基本单位编码', 'en', N'Base Unit Number', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'单位id') IS NULL ALTER TABLE dbo.bl_sale_out ADD [单位id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'单位id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'单位id', N'单位id', N'文本', N'detail', 970, 120, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'单位id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'单位id', 'en', N'Unit Id', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'单位编码') IS NULL ALTER TABLE dbo.bl_sale_out ADD [单位编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'单位编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'单位编码', N'单位编码', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'单位编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'单位编码', 'en', N'Unit Number', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'换算系数') IS NULL ALTER TABLE dbo.bl_sale_out ADD [换算系数] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'换算系数')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'换算系数', N'换算系数', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'换算系数' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'换算系数', 'en', N'Coefficient', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'换算率') IS NULL ALTER TABLE dbo.bl_sale_out ADD [换算率] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'换算率')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'换算率', N'换算率', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'换算率' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'换算率', 'en', N'Conversion Rate', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'库存基本数量') IS NULL ALTER TABLE dbo.bl_sale_out ADD [库存基本数量] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'库存基本数量')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'库存基本数量', N'库存基本数量', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'库存基本数量' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'库存基本数量', 'en', N'Inv Base Qty', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'退货数量') IS NULL ALTER TABLE dbo.bl_sale_out ADD [退货数量] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'退货数量')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'退货数量', N'退货数量', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'退货数量' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'退货数量', 'en', N'Return Qty', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'税额_tax_amount') IS NULL ALTER TABLE dbo.bl_sale_out ADD [税额_tax_amount] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'税额_tax_amount')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'税额_tax_amount', N'税额_tax_amount', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'税额_tax_amount' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'税额_tax_amount', 'en', N'Tax Amount', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'整单折扣分摊') IS NULL ALTER TABLE dbo.bl_sale_out ADD [整单折扣分摊] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'整单折扣分摊')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'整单折扣分摊', N'整单折扣分摊', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'整单折扣分摊' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'整单折扣分摊', 'en', N'Bill Dis Distribution', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'折扣额') IS NULL ALTER TABLE dbo.bl_sale_out ADD [折扣额] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'折扣额')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'折扣额', N'折扣额', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'折扣额' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'折扣额', 'en', N'Discount', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'费用') IS NULL ALTER TABLE dbo.bl_sale_out ADD [费用] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'费用')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'费用', N'费用', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'费用' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'费用', 'en', N'Fee', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'分摊差额') IS NULL ALTER TABLE dbo.bl_sale_out ADD [分摊差额] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'分摊差额')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'分摊差额', N'分摊差额', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'分摊差额' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'分摊差额', 'en', N'Divide Diff Amount', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'折扣率%') IS NULL ALTER TABLE dbo.bl_sale_out ADD [折扣率%] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'折扣率%')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'折扣率%', N'折扣率%', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'折扣率%' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'折扣率%', 'en', N'Dis Rate', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'折前金额') IS NULL ALTER TABLE dbo.bl_sale_out ADD [折前金额] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'折前金额')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'折前金额', N'折前金额', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'折前金额' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'折前金额', 'en', N'Pre Dis Amount', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'实际不含税金额') IS NULL ALTER TABLE dbo.bl_sale_out ADD [实际不含税金额] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'实际不含税金额')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'实际不含税金额', N'实际不含税金额', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'实际不含税金额' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'实际不含税金额', 'en', N'Act Non Tax Amount', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'单位成本') IS NULL ALTER TABLE dbo.bl_sale_out ADD [单位成本] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'单位成本')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'单位成本', N'单位成本', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'单位成本' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'单位成本', 'en', N'Unit Cost', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'成本') IS NULL ALTER TABLE dbo.bl_sale_out ADD [成本] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'成本')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'成本', N'成本', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'成本' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'成本', 'en', N'Cost', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'本次结算金额') IS NULL ALTER TABLE dbo.bl_sale_out ADD [本次结算金额] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'本次结算金额')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'本次结算金额', N'本次结算金额', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'本次结算金额' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'本次结算金额', 'en', N'Cur Settle Amount', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'折扣金额_dis_amount') IS NULL ALTER TABLE dbo.bl_sale_out ADD [折扣金额_dis_amount] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'折扣金额_dis_amount')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'折扣金额_dis_amount', N'折扣金额_dis_amount', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'折扣金额_dis_amount' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'折扣金额_dis_amount', 'en', N'Dis Amount', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'折后单价') IS NULL ALTER TABLE dbo.bl_sale_out ADD [折后单价] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'折后单价')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'折后单价', N'折后单价', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'折后单价' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'折后单价', 'en', N'Dis Price', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'产地') IS NULL ALTER TABLE dbo.bl_sale_out ADD [产地] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'产地')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'产地', N'产地', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'产地' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'产地', 'en', N'Pro Place', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'注册证号') IS NULL ALTER TABLE dbo.bl_sale_out ADD [注册证号] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'注册证号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'注册证号', N'注册证号', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'注册证号' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'注册证号', 'en', N'Pro Reg No', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'生产许可证') IS NULL ALTER TABLE dbo.bl_sale_out ADD [生产许可证] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'生产许可证')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'生产许可证', N'生产许可证', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'生产许可证' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'生产许可证', 'en', N'Pro License', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'保质期到期日') IS NULL ALTER TABLE dbo.bl_sale_out ADD [保质期到期日] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'保质期到期日')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'保质期到期日', N'保质期到期日', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'保质期到期日' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'保质期到期日', 'en', N'Kf Date', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'有效期至') IS NULL ALTER TABLE dbo.bl_sale_out ADD [有效期至] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'有效期至')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'有效期至', N'有效期至', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'有效期至' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'有效期至', 'en', N'Valid Date', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'保质期类型') IS NULL ALTER TABLE dbo.bl_sale_out ADD [保质期类型] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'保质期类型')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'保质期类型', N'保质期类型', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'保质期类型' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'保质期类型', 'en', N'Kf Type', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'保质期') IS NULL ALTER TABLE dbo.bl_sale_out ADD [保质期] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'保质期')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'保质期', N'保质期', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'保质期' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'保质期', 'en', N'Kf Period', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'序列号流转ID') IS NULL ALTER TABLE dbo.bl_sale_out ADD [序列号流转ID] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'序列号流转ID')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'序列号流转ID', N'序列号流转ID', N'文本', N'detail', 970, 120, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'序列号流转ID' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'序列号流转ID', 'en', N'Sn List Id', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'辅助单位id') IS NULL ALTER TABLE dbo.bl_sale_out ADD [辅助单位id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'辅助单位id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'辅助单位id', N'辅助单位id', N'文本', N'detail', 970, 120, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助单位id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助单位id', 'en', N'Aux Unit Id', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'辅助单位编码') IS NULL ALTER TABLE dbo.bl_sale_out ADD [辅助单位编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'辅助单位编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'辅助单位编码', N'辅助单位编码', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助单位编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助单位编码', 'en', N'Aux Unit Number', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'辅助换算系数') IS NULL ALTER TABLE dbo.bl_sale_out ADD [辅助换算系数] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'辅助换算系数')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'辅助换算系数', N'辅助换算系数', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助换算系数' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助换算系数', 'en', N'Aux Coefficient', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'行号') IS NULL ALTER TABLE dbo.bl_sale_out ADD [行号] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'行号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'行号', N'行号', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'行号' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'行号', 'en', N'Seq', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'分录状态') IS NULL ALTER TABLE dbo.bl_sale_out ADD [分录状态] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'分录状态')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'分录状态', N'分录状态', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'分录状态' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'分录状态', 'en', N'Entry Status', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'分录结算状态') IS NULL ALTER TABLE dbo.bl_sale_out ADD [分录结算状态] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'分录结算状态')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'分录结算状态', N'分录结算状态', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'分录结算状态' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'分录结算状态', 'en', N'Entry Settle Status', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'是否赠品') IS NULL ALTER TABLE dbo.bl_sale_out ADD [是否赠品] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'是否赠品')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'是否赠品', N'是否赠品', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'是否赠品' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'是否赠品', 'en', N'Is Free', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'源单id') IS NULL ALTER TABLE dbo.bl_sale_out ADD [源单id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'源单id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'源单id', N'源单id', N'文本', N'detail', 970, 120, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'源单id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'源单id', 'en', N'Src Order Id', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'源单编号') IS NULL ALTER TABLE dbo.bl_sale_out ADD [源单编号] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'源单编号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'源单编号', N'源单编号', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'源单编号' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'源单编号', 'en', N'Src Bill No', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'源单类型id') IS NULL ALTER TABLE dbo.bl_sale_out ADD [源单类型id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'源单类型id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'源单类型id', N'源单类型id', N'文本', N'detail', 970, 120, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'源单类型id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'源单类型id', 'en', N'Src Bill Type Id', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'源单类型名称') IS NULL ALTER TABLE dbo.bl_sale_out ADD [源单类型名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'源单类型名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'源单类型名称', N'源单类型名称', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'源单类型名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'源单类型名称', 'en', N'Src Bill Type Name', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'源单类型编码') IS NULL ALTER TABLE dbo.bl_sale_out ADD [源单类型编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'源单类型编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'源单类型编码', N'源单类型编码', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'源单类型编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'源单类型编码', 'en', N'Src Bill Type Number', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'源单内部id') IS NULL ALTER TABLE dbo.bl_sale_out ADD [源单内部id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'源单内部id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'源单内部id', N'源单内部id', N'文本', N'detail', 970, 120, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'源单内部id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'源单内部id', 'en', N'Src Inter Id', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'源单日期') IS NULL ALTER TABLE dbo.bl_sale_out ADD [源单日期] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'源单日期')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'源单日期', N'源单日期', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'源单日期' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'源单日期', 'en', N'Src Bill Date', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'源单行号') IS NULL ALTER TABLE dbo.bl_sale_out ADD [源单行号] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'源单行号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'源单行号', N'源单行号', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'源单行号' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'源单行号', 'en', N'Src Seq', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'源单分录id') IS NULL ALTER TABLE dbo.bl_sale_out ADD [源单分录id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'源单分录id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'源单分录id', N'源单分录id', N'文本', N'detail', 970, 120, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'源单分录id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'源单分录id', 'en', N'Src Entry Id', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'序列号清单') IS NULL ALTER TABLE dbo.bl_sale_out ADD [序列号清单] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'序列号清单')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'序列号清单', N'序列号清单', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'序列号清单' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'序列号清单', 'en', N'Sn List', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'基本数量') IS NULL ALTER TABLE dbo.bl_sale_out ADD [基本数量] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'基本数量')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'基本数量', N'基本数量', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'基本数量' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'基本数量', 'en', N'Base Qty', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'折扣税额') IS NULL ALTER TABLE dbo.bl_sale_out ADD [折扣税额] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'折扣税额')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'折扣税额', N'折扣税额', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'折扣税额' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'折扣税额', 'en', N'Dis Tax Amount', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'客户单号') IS NULL ALTER TABLE dbo.bl_sale_out ADD [客户单号] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'客户单号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'客户单号', N'客户单号', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'客户单号' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'客户单号', 'en', N'Cus Bill No', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'未开票数量') IS NULL ALTER TABLE dbo.bl_sale_out ADD [未开票数量] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'未开票数量')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'未开票数量', N'未开票数量', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'未开票数量' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'未开票数量', 'en', N'Entry Un Ivc Qty', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'已开票数量') IS NULL ALTER TABLE dbo.bl_sale_out ADD [已开票数量] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'已开票数量')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'已开票数量', N'已开票数量', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'已开票数量' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'已开票数量', 'en', N'Entry Ivc Qty', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'已开票金额') IS NULL ALTER TABLE dbo.bl_sale_out ADD [已开票金额] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'已开票金额')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'已开票金额', N'已开票金额', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'已开票金额' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'已开票金额', 'en', N'Entry Ivc Amount', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'未开票金额') IS NULL ALTER TABLE dbo.bl_sale_out ADD [未开票金额] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'未开票金额')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'未开票金额', N'未开票金额', N'文本', N'detail', 970, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'未开票金额' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'未开票金额', 'en', N'Entry Un Ivc Amount', 'manual');
IF COL_LENGTH('dbo.bl_sale_out', N'价税合计本位币') IS NULL ALTER TABLE dbo.bl_sale_out ADD [价税合计本位币] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'价税合计本位币')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'价税合计本位币', N'价税合计本位币', N'文本', N'detail', 970, 120, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'价税合计本位币' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'价税合计本位币', 'en', N'All Amount For', 'manual');
GO

PRINT N'migrate-inbound-outbound-fields 完成';
GO