-- migrate-material-out-fields.sql — 材料出库单(MATERIAL_OUT)面板字段与「金蝶·生产领料单 inv_pick」接口并集对应
-- 生成器:tools/archive/_gen-material-out.mjs(勿手改;改口径请改生成器后重跑)
-- 依据:金蝶云·星辰真实账套只读实测(生产领料单 4801 张,采样 40 张/156 行,探针 deploy/_probe-invpick-fields.mjs)
--   · 头并集 = 列表键 ∪ 详情键;行并集 = material_entity 子表键;类型统一 nvarchar(500)(与采购入库同款)
--   · 已由现有列代表的键不重复建列:头 bill_no/bill_date/remark/dept_name/emp_name;行 material_number/material_name/material_model/qty/price/unit_name/stock_name/batch_no/comment
--   · 可见性=实测常见(非空率≥50% 且非恒零);id/创建人/修改人/图片等恒定隐藏;价格族(成本/单位成本)强制显示
--   · ⚠ 金蝶生产领料单**没有税金族键**(无 税率%/税额/含税单价/金额/价税合计)——按用户口径不建税金列
SET NOCOUNT ON;
GO

-- 头.创建时间  ← 金蝶 inv_pick 头键 create_time(实测非空 40/40)
IF COL_LENGTH('dbo.bd_material_out', N'创建时间') IS NULL ALTER TABLE dbo.bd_material_out ADD [创建时间] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'创建时间')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'创建时间', N'创建时间', N'文本', N'header', 970, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'创建时间' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'创建时间', 'en', N'Create Time', 'manual');
-- 头.单据状态_bill_status  ← 金蝶 inv_pick 头键 bill_status(实测非空 40/40)
IF COL_LENGTH('dbo.bd_material_out', N'单据状态_bill_status') IS NULL ALTER TABLE dbo.bd_material_out ADD [单据状态_bill_status] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'单据状态_bill_status')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'单据状态_bill_status', N'单据状态_bill_status', N'文本', N'header', 971, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'单据状态_bill_status' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'单据状态_bill_status', 'en', N'Bill Status', 'manual');
-- 头.dept_id  ← 金蝶 inv_pick 头键 dept_id(实测非空 40/40)
IF COL_LENGTH('dbo.bd_material_out', N'dept_id') IS NULL ALTER TABLE dbo.bd_material_out ADD [dept_id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'dept_id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'dept_id', N'dept_id', N'文本', N'header', 972, 130, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'dept_id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'dept_id', 'en', N'Dept Id', 'manual');
-- 头.部门编码  ← 金蝶 inv_pick 头键 dept_number(实测非空 40/40)
IF COL_LENGTH('dbo.bd_material_out', N'部门编码') IS NULL ALTER TABLE dbo.bd_material_out ADD [部门编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'部门编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'部门编码', N'部门编码', N'文本', N'header', 973, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'部门编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'部门编码', 'en', N'Dept Number', 'manual');
-- 头.领料类型  ← 金蝶 inv_pick 头键 pick_type(实测非空 40/40)
IF COL_LENGTH('dbo.bd_material_out', N'领料类型') IS NULL ALTER TABLE dbo.bd_material_out ADD [领料类型] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'领料类型')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'领料类型', N'领料类型', N'文本', N'header', 974, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'领料类型' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'领料类型', 'en', N'Pick Type', 'manual');
-- 头.修改时间  ← 金蝶 inv_pick 头键 modify_time(实测非空 40/40)
IF COL_LENGTH('dbo.bd_material_out', N'修改时间') IS NULL ALTER TABLE dbo.bd_material_out ADD [修改时间] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'修改时间')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'修改时间', N'修改时间', N'文本', N'header', 975, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'修改时间' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'修改时间', 'en', N'Modify Time', 'manual');
-- 头.审核时间_audit_time  ← 金蝶 inv_pick 头键 audit_time(实测非空 40/40)
IF COL_LENGTH('dbo.bd_material_out', N'审核时间_audit_time') IS NULL ALTER TABLE dbo.bd_material_out ADD [审核时间_audit_time] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'审核时间_audit_time')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'审核时间_audit_time', N'审核时间_audit_time', N'文本', N'header', 976, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'审核时间_audit_time' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'审核时间_audit_time', 'en', N'Audit Time', 'manual');
-- 头.creator_id  ← 金蝶 inv_pick 头键 creator_id(实测非空 40/40)
IF COL_LENGTH('dbo.bd_material_out', N'creator_id') IS NULL ALTER TABLE dbo.bd_material_out ADD [creator_id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'creator_id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'creator_id', N'creator_id', N'文本', N'header', 977, 130, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'creator_id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'creator_id', 'en', N'Creator Id', 'manual');
-- 头.创建人  ← 金蝶 inv_pick 头键 creator_name(实测非空 40/40)
IF COL_LENGTH('dbo.bd_material_out', N'创建人') IS NULL ALTER TABLE dbo.bd_material_out ADD [创建人] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'创建人')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'创建人', N'创建人', N'文本', N'header', 978, 130, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'创建人' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'创建人', 'en', N'Creator Name', 'manual');
-- 头.创建人编码  ← 金蝶 inv_pick 头键 creator_number(实测非空 40/40)
IF COL_LENGTH('dbo.bd_material_out', N'创建人编码') IS NULL ALTER TABLE dbo.bd_material_out ADD [创建人编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'创建人编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'创建人编码', N'创建人编码', N'文本', N'header', 979, 130, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'创建人编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'创建人编码', 'en', N'Creator Number', 'manual');
-- 头.modifier_id  ← 金蝶 inv_pick 头键 modifier_id(实测非空 40/40)
IF COL_LENGTH('dbo.bd_material_out', N'modifier_id') IS NULL ALTER TABLE dbo.bd_material_out ADD [modifier_id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'modifier_id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'modifier_id', N'modifier_id', N'文本', N'header', 980, 130, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'modifier_id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'modifier_id', 'en', N'Modifier Id', 'manual');
-- 头.修改人  ← 金蝶 inv_pick 头键 modifier_name(实测非空 40/40)
IF COL_LENGTH('dbo.bd_material_out', N'修改人') IS NULL ALTER TABLE dbo.bd_material_out ADD [修改人] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'修改人')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'修改人', N'修改人', N'文本', N'header', 981, 130, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'修改人' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'修改人', 'en', N'Modifier Name', 'manual');
-- 头.修改人编码  ← 金蝶 inv_pick 头键 modifier_number(实测非空 40/40)
IF COL_LENGTH('dbo.bd_material_out', N'修改人编码') IS NULL ALTER TABLE dbo.bd_material_out ADD [修改人编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'修改人编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'修改人编码', N'修改人编码', N'文本', N'header', 982, 130, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'修改人编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'修改人编码', 'en', N'Modifier Number', 'manual');
-- 头.单据类型名称  ← 金蝶 inv_pick 头键 bill_type_name(实测非空 40/40)
IF COL_LENGTH('dbo.bd_material_out', N'单据类型名称') IS NULL ALTER TABLE dbo.bd_material_out ADD [单据类型名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'单据类型名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'单据类型名称', N'单据类型名称', N'文本', N'header', 983, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'单据类型名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'单据类型名称', 'en', N'Bill Type Name', 'manual');
-- 头.单据类型编码  ← 金蝶 inv_pick 头键 bill_type_number(实测非空 40/40)
IF COL_LENGTH('dbo.bd_material_out', N'单据类型编码') IS NULL ALTER TABLE dbo.bd_material_out ADD [单据类型编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'单据类型编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'单据类型编码', N'单据类型编码', N'文本', N'header', 984, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'单据类型编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'单据类型编码', 'en', N'Bill Type Number', 'manual');
-- 头.bill_type_id  ← 金蝶 inv_pick 头键 bill_type_id(实测非空 40/40)
IF COL_LENGTH('dbo.bd_material_out', N'bill_type_id') IS NULL ALTER TABLE dbo.bd_material_out ADD [bill_type_id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'bill_type_id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'bill_type_id', N'bill_type_id', N'文本', N'header', 985, 130, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'bill_type_id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'bill_type_id', 'en', N'Bill Type Id', 'manual');
-- 头.auditor_id  ← 金蝶 inv_pick 头键 auditor_id(实测非空 40/40)
IF COL_LENGTH('dbo.bd_material_out', N'auditor_id') IS NULL ALTER TABLE dbo.bd_material_out ADD [auditor_id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'auditor_id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'auditor_id', N'auditor_id', N'文本', N'header', 986, 130, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'auditor_id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'auditor_id', 'en', N'Auditor Id', 'manual');
-- 头.审核人_auditor_name  ← 金蝶 inv_pick 头键 auditor_name(实测非空 40/40)
IF COL_LENGTH('dbo.bd_material_out', N'审核人_auditor_name') IS NULL ALTER TABLE dbo.bd_material_out ADD [审核人_auditor_name] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'审核人_auditor_name')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'审核人_auditor_name', N'审核人_auditor_name', N'文本', N'header', 987, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'审核人_auditor_name' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'审核人_auditor_name', 'en', N'Auditor Name', 'manual');
-- 头.审核人编码  ← 金蝶 inv_pick 头键 auditor_number(实测非空 40/40)
IF COL_LENGTH('dbo.bd_material_out', N'审核人编码') IS NULL ALTER TABLE dbo.bd_material_out ADD [审核人编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'审核人编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'审核人编码', N'审核人编码', N'文本', N'header', 988, 130, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'审核人编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'审核人编码', 'en', N'Auditor Number', 'manual');
-- 头.emp_id  ← 金蝶 inv_pick 头键 emp_id(实测非空 40/40)
IF COL_LENGTH('dbo.bd_material_out', N'emp_id') IS NULL ALTER TABLE dbo.bd_material_out ADD [emp_id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'emp_id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'emp_id', N'emp_id', N'文本', N'header', 989, 130, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'emp_id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'emp_id', 'en', N'Emp Id', 'manual');
-- 头.经手人编码  ← 金蝶 inv_pick 头键 emp_number(实测非空 39/40)
IF COL_LENGTH('dbo.bd_material_out', N'经手人编码') IS NULL ALTER TABLE dbo.bd_material_out ADD [经手人编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'经手人编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'经手人编码', N'经手人编码', N'文本', N'header', 990, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'经手人编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'经手人编码', 'en', N'Emp Number', 'manual');
-- 头.单据标签  ← 金蝶 inv_pick 头键 mul_bill_label(实测非空 0/40)
IF COL_LENGTH('dbo.bd_material_out', N'单据标签') IS NULL ALTER TABLE dbo.bd_material_out ADD [单据标签] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'单据标签')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'单据标签', N'单据标签', N'文本', N'header', 991, 130, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'单据标签' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'单据标签', 'en', N'Mul Bill Label', 'manual');
-- 头.领料用途名称  ← 金蝶 inv_pick 头键 pick_use_name(实测非空 0/40)
IF COL_LENGTH('dbo.bd_material_out', N'领料用途名称') IS NULL ALTER TABLE dbo.bd_material_out ADD [领料用途名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'领料用途名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'领料用途名称', N'领料用途名称', N'文本', N'header', 992, 130, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'领料用途名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'领料用途名称', 'en', N'Pick Use Name', 'manual');
-- 头.pick_use_id  ← 金蝶 inv_pick 头键 pick_use_id(实测非空 0/40)
IF COL_LENGTH('dbo.bd_material_out', N'pick_use_id') IS NULL ALTER TABLE dbo.bd_material_out ADD [pick_use_id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'pick_use_id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'pick_use_id', N'pick_use_id', N'文本', N'header', 993, 130, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'pick_use_id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'pick_use_id', 'en', N'Pick Use Id', 'manual');
-- 头.领料用途编码  ← 金蝶 inv_pick 头键 pick_use_number(实测非空 0/40)
IF COL_LENGTH('dbo.bd_material_out', N'领料用途编码') IS NULL ALTER TABLE dbo.bd_material_out ADD [领料用途编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'领料用途编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'领料用途编码', N'领料用途编码', N'文本', N'header', 994, 130, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'领料用途编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'领料用途编码', 'en', N'Pick Use Number', 'manual');
GO

-- 行.图片  ← 金蝶 inv_pick 行键 picture(实测非空 0/156)
IF COL_LENGTH('dbo.bl_material_out', N'图片') IS NULL ALTER TABLE dbo.bl_material_out ADD [图片] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'图片')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'图片', N'图片', N'文本', N'detail', 970, 120, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'图片' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'图片', 'en', N'Picture', 'manual');
-- 行.行号  ← 金蝶 inv_pick 行键 seq(实测非空 156/156)
IF COL_LENGTH('dbo.bl_material_out', N'行号') IS NULL ALTER TABLE dbo.bl_material_out ADD [行号] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'行号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'行号', N'行号', N'文本', N'detail', 971, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'行号' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'行号', 'en', N'Seq', 'manual');
-- 行.商品id  ← 金蝶 inv_pick 行键 material_id(实测非空 156/156)
IF COL_LENGTH('dbo.bl_material_out', N'商品id') IS NULL ALTER TABLE dbo.bl_material_out ADD [商品id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'商品id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'商品id', N'商品id', N'文本', N'detail', 972, 120, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'商品id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'商品id', 'en', N'Material Id', 'manual');
-- 行.商品是否多单位  ← 金蝶 inv_pick 行键 material_is_multi_unit(实测非空 156/156)
IF COL_LENGTH('dbo.bl_material_out', N'商品是否多单位') IS NULL ALTER TABLE dbo.bl_material_out ADD [商品是否多单位] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'商品是否多单位')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'商品是否多单位', N'商品是否多单位', N'文本', N'detail', 973, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'商品是否多单位' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'商品是否多单位', 'en', N'Material Is Multi Unit', 'manual');
-- 行.商品是否序列号  ← 金蝶 inv_pick 行键 material_is_serial(实测非空 156/156)
IF COL_LENGTH('dbo.bl_material_out', N'商品是否序列号') IS NULL ALTER TABLE dbo.bl_material_out ADD [商品是否序列号] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'商品是否序列号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'商品是否序列号', N'商品是否序列号', N'文本', N'detail', 974, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'商品是否序列号' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'商品是否序列号', 'en', N'Material Is Serial', 'manual');
-- 行.商品是否辅助属性  ← 金蝶 inv_pick 行键 material_is_asst_attr(实测非空 156/156)
IF COL_LENGTH('dbo.bl_material_out', N'商品是否辅助属性') IS NULL ALTER TABLE dbo.bl_material_out ADD [商品是否辅助属性] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'商品是否辅助属性')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'商品是否辅助属性', N'商品是否辅助属性', N'文本', N'detail', 975, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'商品是否辅助属性' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'商品是否辅助属性', 'en', N'Material Is Asst Attr', 'manual');
-- 行.商品是否保质期  ← 金蝶 inv_pick 行键 material_is_kf_period(实测非空 156/156)
IF COL_LENGTH('dbo.bl_material_out', N'商品是否保质期') IS NULL ALTER TABLE dbo.bl_material_out ADD [商品是否保质期] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'商品是否保质期')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'商品是否保质期', N'商品是否保质期', N'文本', N'detail', 976, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'商品是否保质期' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'商品是否保质期', 'en', N'Material Is Kf Period', 'manual');
-- 行.商品是否批次  ← 金蝶 inv_pick 行键 material_is_batch(实测非空 156/156)
IF COL_LENGTH('dbo.bl_material_out', N'商品是否批次') IS NULL ALTER TABLE dbo.bl_material_out ADD [商品是否批次] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'商品是否批次')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'商品是否批次', N'商品是否批次', N'文本', N'detail', 977, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'商品是否批次' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'商品是否批次', 'en', N'Material Is Batch', 'manual');
-- 行.仓库id  ← 金蝶 inv_pick 行键 stock_id(实测非空 156/156)
IF COL_LENGTH('dbo.bl_material_out', N'仓库id') IS NULL ALTER TABLE dbo.bl_material_out ADD [仓库id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'仓库id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'仓库id', N'仓库id', N'文本', N'detail', 978, 120, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'仓库id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'仓库id', 'en', N'Stock Id', 'manual');
-- 行.仓库编码  ← 金蝶 inv_pick 行键 stock_number(实测非空 156/156)
IF COL_LENGTH('dbo.bl_material_out', N'仓库编码') IS NULL ALTER TABLE dbo.bl_material_out ADD [仓库编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'仓库编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'仓库编码', N'仓库编码', N'文本', N'detail', 979, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'仓库编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'仓库编码', 'en', N'Stock Number', 'manual');
-- 行.仓库启用仓位管理  ← 金蝶 inv_pick 行键 stock_is_allow_freight(实测非空 156/156)
IF COL_LENGTH('dbo.bl_material_out', N'仓库启用仓位管理') IS NULL ALTER TABLE dbo.bl_material_out ADD [仓库启用仓位管理] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'仓库启用仓位管理')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'仓库启用仓位管理', N'仓库启用仓位管理', N'文本', N'detail', 980, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'仓库启用仓位管理' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'仓库启用仓位管理', 'en', N'Stock Is Allow Freight', 'manual');
-- 行.仓位id  ← 金蝶 inv_pick 行键 sp_id(实测非空 0/156)
IF COL_LENGTH('dbo.bl_material_out', N'仓位id') IS NULL ALTER TABLE dbo.bl_material_out ADD [仓位id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'仓位id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'仓位id', N'仓位id', N'文本', N'detail', 981, 120, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'仓位id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'仓位id', 'en', N'Sp Id', 'manual');
-- 行.仓位名称  ← 金蝶 inv_pick 行键 sp_name(实测非空 0/156)
IF COL_LENGTH('dbo.bl_material_out', N'仓位名称') IS NULL ALTER TABLE dbo.bl_material_out ADD [仓位名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'仓位名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'仓位名称', N'仓位名称', N'文本', N'detail', 982, 120, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'仓位名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'仓位名称', 'en', N'Sp Name', 'manual');
-- 行.仓位编码  ← 金蝶 inv_pick 行键 sp_number(实测非空 0/156)
IF COL_LENGTH('dbo.bl_material_out', N'仓位编码') IS NULL ALTER TABLE dbo.bl_material_out ADD [仓位编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'仓位编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'仓位编码', N'仓位编码', N'文本', N'detail', 983, 120, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'仓位编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'仓位编码', 'en', N'Sp Number', 'manual');
-- 行.辅助属性id  ← 金蝶 inv_pick 行键 aux_prop_id(实测非空 0/156)
IF COL_LENGTH('dbo.bl_material_out', N'辅助属性id') IS NULL ALTER TABLE dbo.bl_material_out ADD [辅助属性id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'辅助属性id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'辅助属性id', N'辅助属性id', N'文本', N'detail', 984, 120, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助属性id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助属性id', 'en', N'Aux Prop Id', 'manual');
-- 行.辅助属性名称  ← 金蝶 inv_pick 行键 aux_prop_name(实测非空 0/156)
IF COL_LENGTH('dbo.bl_material_out', N'辅助属性名称') IS NULL ALTER TABLE dbo.bl_material_out ADD [辅助属性名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'辅助属性名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'辅助属性名称', N'辅助属性名称', N'文本', N'detail', 985, 120, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助属性名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助属性名称', 'en', N'Aux Prop Name', 'manual');
-- 行.辅助属性编码  ← 金蝶 inv_pick 行键 aux_prop_number(实测非空 0/156)
IF COL_LENGTH('dbo.bl_material_out', N'辅助属性编码') IS NULL ALTER TABLE dbo.bl_material_out ADD [辅助属性编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'辅助属性编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'辅助属性编码', N'辅助属性编码', N'文本', N'detail', 986, 120, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助属性编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助属性编码', 'en', N'Aux Prop Number', 'manual');
-- 行.辅助属性1id  ← 金蝶 inv_pick 行键 aux1_id(实测非空 0/156)
IF COL_LENGTH('dbo.bl_material_out', N'辅助属性1id') IS NULL ALTER TABLE dbo.bl_material_out ADD [辅助属性1id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'辅助属性1id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'辅助属性1id', N'辅助属性1id', N'文本', N'detail', 987, 120, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助属性1id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助属性1id', 'en', N'Aux1 Id', 'manual');
-- 行.辅助属性1名称  ← 金蝶 inv_pick 行键 aux1_name(实测非空 0/156)
IF COL_LENGTH('dbo.bl_material_out', N'辅助属性1名称') IS NULL ALTER TABLE dbo.bl_material_out ADD [辅助属性1名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'辅助属性1名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'辅助属性1名称', N'辅助属性1名称', N'文本', N'detail', 988, 120, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助属性1名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助属性1名称', 'en', N'Aux1 Name', 'manual');
-- 行.辅助属性1编码  ← 金蝶 inv_pick 行键 aux1_number(实测非空 0/156)
IF COL_LENGTH('dbo.bl_material_out', N'辅助属性1编码') IS NULL ALTER TABLE dbo.bl_material_out ADD [辅助属性1编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'辅助属性1编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'辅助属性1编码', N'辅助属性1编码', N'文本', N'detail', 989, 120, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助属性1编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助属性1编码', 'en', N'Aux1 Number', 'manual');
-- 行.辅助属性2id  ← 金蝶 inv_pick 行键 aux2_id(实测非空 0/156)
IF COL_LENGTH('dbo.bl_material_out', N'辅助属性2id') IS NULL ALTER TABLE dbo.bl_material_out ADD [辅助属性2id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'辅助属性2id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'辅助属性2id', N'辅助属性2id', N'文本', N'detail', 990, 120, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助属性2id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助属性2id', 'en', N'Aux2 Id', 'manual');
-- 行.辅助属性2名称  ← 金蝶 inv_pick 行键 aux2_name(实测非空 0/156)
IF COL_LENGTH('dbo.bl_material_out', N'辅助属性2名称') IS NULL ALTER TABLE dbo.bl_material_out ADD [辅助属性2名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'辅助属性2名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'辅助属性2名称', N'辅助属性2名称', N'文本', N'detail', 991, 120, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助属性2名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助属性2名称', 'en', N'Aux2 Name', 'manual');
-- 行.辅助属性2编码  ← 金蝶 inv_pick 行键 aux2_number(实测非空 0/156)
IF COL_LENGTH('dbo.bl_material_out', N'辅助属性2编码') IS NULL ALTER TABLE dbo.bl_material_out ADD [辅助属性2编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'辅助属性2编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'辅助属性2编码', N'辅助属性2编码', N'文本', N'detail', 992, 120, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助属性2编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助属性2编码', 'en', N'Aux2 Number', 'manual');
-- 行.辅助属性3id  ← 金蝶 inv_pick 行键 aux3_id(实测非空 0/156)
IF COL_LENGTH('dbo.bl_material_out', N'辅助属性3id') IS NULL ALTER TABLE dbo.bl_material_out ADD [辅助属性3id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'辅助属性3id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'辅助属性3id', N'辅助属性3id', N'文本', N'detail', 993, 120, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助属性3id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助属性3id', 'en', N'Aux3 Id', 'manual');
-- 行.辅助属性3名称  ← 金蝶 inv_pick 行键 aux3_name(实测非空 0/156)
IF COL_LENGTH('dbo.bl_material_out', N'辅助属性3名称') IS NULL ALTER TABLE dbo.bl_material_out ADD [辅助属性3名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'辅助属性3名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'辅助属性3名称', N'辅助属性3名称', N'文本', N'detail', 994, 120, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助属性3名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助属性3名称', 'en', N'Aux3 Name', 'manual');
-- 行.辅助属性3编码  ← 金蝶 inv_pick 行键 aux3_number(实测非空 0/156)
IF COL_LENGTH('dbo.bl_material_out', N'辅助属性3编码') IS NULL ALTER TABLE dbo.bl_material_out ADD [辅助属性3编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'辅助属性3编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'辅助属性3编码', N'辅助属性3编码', N'文本', N'detail', 995, 120, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助属性3编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助属性3编码', 'en', N'Aux3 Number', 'manual');
-- 行.条形码  ← 金蝶 inv_pick 行键 barcode(实测非空 0/156)
IF COL_LENGTH('dbo.bl_material_out', N'条形码') IS NULL ALTER TABLE dbo.bl_material_out ADD [条形码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'条形码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'条形码', N'条形码', N'文本', N'detail', 996, 120, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'条形码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'条形码', 'en', N'Barcode', 'manual');
-- 行.产地  ← 金蝶 inv_pick 行键 pro_place(实测非空 0/156)
IF COL_LENGTH('dbo.bl_material_out', N'产地') IS NULL ALTER TABLE dbo.bl_material_out ADD [产地] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'产地')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'产地', N'产地', N'文本', N'detail', 997, 120, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'产地' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'产地', 'en', N'Pro Place', 'manual');
-- 行.注册证号  ← 金蝶 inv_pick 行键 pro_reg_no(实测非空 0/156)
IF COL_LENGTH('dbo.bl_material_out', N'注册证号') IS NULL ALTER TABLE dbo.bl_material_out ADD [注册证号] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'注册证号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'注册证号', N'注册证号', N'文本', N'detail', 998, 120, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'注册证号' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'注册证号', 'en', N'Pro Reg No', 'manual');
-- 行.生产许可证  ← 金蝶 inv_pick 行键 pro_license(实测非空 0/156)
IF COL_LENGTH('dbo.bl_material_out', N'生产许可证') IS NULL ALTER TABLE dbo.bl_material_out ADD [生产许可证] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'生产许可证')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'生产许可证', N'生产许可证', N'文本', N'detail', 999, 120, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'生产许可证' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'生产许可证', 'en', N'Pro License', 'manual');
-- 行.保质期到期日  ← 金蝶 inv_pick 行键 kf_date(实测非空 0/156)
IF COL_LENGTH('dbo.bl_material_out', N'保质期到期日') IS NULL ALTER TABLE dbo.bl_material_out ADD [保质期到期日] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'保质期到期日')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'保质期到期日', N'保质期到期日', N'文本', N'detail', 1000, 120, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'保质期到期日' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'保质期到期日', 'en', N'Kf Date', 'manual');
-- 行.有效期至  ← 金蝶 inv_pick 行键 valid_date(实测非空 0/156)
IF COL_LENGTH('dbo.bl_material_out', N'有效期至') IS NULL ALTER TABLE dbo.bl_material_out ADD [有效期至] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'有效期至')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'有效期至', N'有效期至', N'文本', N'detail', 1001, 120, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'有效期至' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'有效期至', 'en', N'Valid Date', 'manual');
-- 行.保质期类型  ← 金蝶 inv_pick 行键 kf_type(实测非空 0/156)
IF COL_LENGTH('dbo.bl_material_out', N'保质期类型') IS NULL ALTER TABLE dbo.bl_material_out ADD [保质期类型] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'保质期类型')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'保质期类型', N'保质期类型', N'文本', N'detail', 1002, 120, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'保质期类型' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'保质期类型', 'en', N'Kf Type', 'manual');
-- 行.保质期  ← 金蝶 inv_pick 行键 kf_period(实测非空 156/156)
IF COL_LENGTH('dbo.bl_material_out', N'保质期') IS NULL ALTER TABLE dbo.bl_material_out ADD [保质期] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'保质期')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'保质期', N'保质期', N'文本', N'detail', 1003, 120, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'保质期' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'保质期', 'en', N'Kf Period', 'manual');
-- 行.序列号清单  ← 金蝶 inv_pick 行键 sn_list(实测非空 0/156)
IF COL_LENGTH('dbo.bl_material_out', N'序列号清单') IS NULL ALTER TABLE dbo.bl_material_out ADD [序列号清单] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'序列号清单')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'序列号清单', N'序列号清单', N'文本', N'detail', 1004, 120, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'序列号清单' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'序列号清单', 'en', N'Sn List', 'manual');
-- 行.序列号流转ID  ← 金蝶 inv_pick 行键 sn_list_id(实测非空 156/156)
IF COL_LENGTH('dbo.bl_material_out', N'序列号流转ID') IS NULL ALTER TABLE dbo.bl_material_out ADD [序列号流转ID] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'序列号流转ID')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'序列号流转ID', N'序列号流转ID', N'文本', N'detail', 1005, 120, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'序列号流转ID' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'序列号流转ID', 'en', N'Sn List Id', 'manual');
-- 行.基本单位id  ← 金蝶 inv_pick 行键 base_unit_id(实测非空 156/156)
IF COL_LENGTH('dbo.bl_material_out', N'基本单位id') IS NULL ALTER TABLE dbo.bl_material_out ADD [基本单位id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'基本单位id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'基本单位id', N'基本单位id', N'文本', N'detail', 1006, 120, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'基本单位id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'基本单位id', 'en', N'Base Unit Id', 'manual');
-- 行.基本单位名称  ← 金蝶 inv_pick 行键 base_unit_name(实测非空 156/156)
IF COL_LENGTH('dbo.bl_material_out', N'基本单位名称') IS NULL ALTER TABLE dbo.bl_material_out ADD [基本单位名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'基本单位名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'基本单位名称', N'基本单位名称', N'文本', N'detail', 1007, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'基本单位名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'基本单位名称', 'en', N'Base Unit Name', 'manual');
-- 行.基本单位编码  ← 金蝶 inv_pick 行键 base_unit_number(实测非空 156/156)
IF COL_LENGTH('dbo.bl_material_out', N'基本单位编码') IS NULL ALTER TABLE dbo.bl_material_out ADD [基本单位编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'基本单位编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'基本单位编码', N'基本单位编码', N'文本', N'detail', 1008, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'基本单位编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'基本单位编码', 'en', N'Base Unit Number', 'manual');
-- 行.单位id  ← 金蝶 inv_pick 行键 unit_id(实测非空 156/156)
IF COL_LENGTH('dbo.bl_material_out', N'单位id') IS NULL ALTER TABLE dbo.bl_material_out ADD [单位id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'单位id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'单位id', N'单位id', N'文本', N'detail', 1009, 120, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'单位id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'单位id', 'en', N'Unit Id', 'manual');
-- 行.单位编码  ← 金蝶 inv_pick 行键 unit_number(实测非空 156/156)
IF COL_LENGTH('dbo.bl_material_out', N'单位编码') IS NULL ALTER TABLE dbo.bl_material_out ADD [单位编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'单位编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'单位编码', N'单位编码', N'文本', N'detail', 1010, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'单位编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'单位编码', 'en', N'Unit Number', 'manual');
-- 行.辅助单位id  ← 金蝶 inv_pick 行键 aux_unit_id(实测非空 5/156)
IF COL_LENGTH('dbo.bl_material_out', N'辅助单位id') IS NULL ALTER TABLE dbo.bl_material_out ADD [辅助单位id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'辅助单位id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'辅助单位id', N'辅助单位id', N'文本', N'detail', 1011, 120, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助单位id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助单位id', 'en', N'Aux Unit Id', 'manual');
-- 行.辅助单位名称  ← 金蝶 inv_pick 行键 aux_unit_name(实测非空 5/156)
IF COL_LENGTH('dbo.bl_material_out', N'辅助单位名称') IS NULL ALTER TABLE dbo.bl_material_out ADD [辅助单位名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'辅助单位名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'辅助单位名称', N'辅助单位名称', N'文本', N'detail', 1012, 120, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助单位名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助单位名称', 'en', N'Aux Unit Name', 'manual');
-- 行.辅助单位编码  ← 金蝶 inv_pick 行键 aux_unit_number(实测非空 5/156)
IF COL_LENGTH('dbo.bl_material_out', N'辅助单位编码') IS NULL ALTER TABLE dbo.bl_material_out ADD [辅助单位编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'辅助单位编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'辅助单位编码', N'辅助单位编码', N'文本', N'detail', 1013, 120, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助单位编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助单位编码', 'en', N'Aux Unit Number', 'manual');
-- 行.换算率  ← 金蝶 inv_pick 行键 conversion_rate(实测非空 5/156)
IF COL_LENGTH('dbo.bl_material_out', N'换算率') IS NULL ALTER TABLE dbo.bl_material_out ADD [换算率] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'换算率')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'换算率', N'换算率', N'文本', N'detail', 1014, 120, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'换算率' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'换算率', 'en', N'Conversion Rate', 'manual');
-- 行.库存数量  ← 金蝶 inv_pick 行键 inv_qty(实测非空 156/156)
IF COL_LENGTH('dbo.bl_material_out', N'库存数量') IS NULL ALTER TABLE dbo.bl_material_out ADD [库存数量] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'库存数量')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'库存数量', N'库存数量', N'文本', N'detail', 1015, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'库存数量' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'库存数量', 'en', N'Inv Qty', 'manual');
-- 行.基本数量  ← 金蝶 inv_pick 行键 base_qty(实测非空 156/156)
IF COL_LENGTH('dbo.bl_material_out', N'基本数量') IS NULL ALTER TABLE dbo.bl_material_out ADD [基本数量] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'基本数量')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'基本数量', N'基本数量', N'文本', N'detail', 1016, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'基本数量' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'基本数量', 'en', N'Base Qty', 'manual');
-- 行.库存基本数量  ← 金蝶 inv_pick 行键 inv_base_qty(实测非空 156/156)
IF COL_LENGTH('dbo.bl_material_out', N'库存基本数量') IS NULL ALTER TABLE dbo.bl_material_out ADD [库存基本数量] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'库存基本数量')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'库存基本数量', N'库存基本数量', N'文本', N'detail', 1017, 120, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'库存基本数量' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'库存基本数量', 'en', N'Inv Base Qty', 'manual');
-- 行.辅助数量  ← 金蝶 inv_pick 行键 aux_qty(实测非空 156/156)
IF COL_LENGTH('dbo.bl_material_out', N'辅助数量') IS NULL ALTER TABLE dbo.bl_material_out ADD [辅助数量] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'辅助数量')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'辅助数量', N'辅助数量', N'文本', N'detail', 1018, 120, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助数量' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助数量', 'en', N'Aux Qty', 'manual');
-- 行.默认浮动数量  ← 金蝶 inv_pick 行键 def_float_qty(实测非空 156/156)
IF COL_LENGTH('dbo.bl_material_out', N'默认浮动数量') IS NULL ALTER TABLE dbo.bl_material_out ADD [默认浮动数量] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'默认浮动数量')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'默认浮动数量', N'默认浮动数量', N'文本', N'detail', 1019, 120, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'默认浮动数量' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'默认浮动数量', 'en', N'Def Float Qty', 'manual');
-- 行.辅助换算系数  ← 金蝶 inv_pick 行键 aux_coefficient(实测非空 156/156)
IF COL_LENGTH('dbo.bl_material_out', N'辅助换算系数') IS NULL ALTER TABLE dbo.bl_material_out ADD [辅助换算系数] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'辅助换算系数')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'辅助换算系数', N'辅助换算系数', N'文本', N'detail', 1020, 120, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助换算系数' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助换算系数', 'en', N'Aux Coefficient', 'manual');
-- 行.换算系数  ← 金蝶 inv_pick 行键 coefficient(实测非空 156/156)
IF COL_LENGTH('dbo.bl_material_out', N'换算系数') IS NULL ALTER TABLE dbo.bl_material_out ADD [换算系数] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'换算系数')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'换算系数', N'换算系数', N'文本', N'detail', 1021, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'换算系数' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'换算系数', 'en', N'Coefficient', 'manual');
-- 行.成本  ← 金蝶 inv_pick 行键 cost(实测非空 156/156)
IF COL_LENGTH('dbo.bl_material_out', N'成本') IS NULL ALTER TABLE dbo.bl_material_out ADD [成本] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'成本')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'成本', N'成本', N'文本', N'detail', 1022, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'成本' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'成本', 'en', N'Cost', 'manual');
-- 行.单位成本  ← 金蝶 inv_pick 行键 unit_cost(实测非空 156/156)
IF COL_LENGTH('dbo.bl_material_out', N'单位成本') IS NULL ALTER TABLE dbo.bl_material_out ADD [单位成本] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'单位成本')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'单位成本', N'单位成本', N'文本', N'detail', 1023, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'单位成本' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'单位成本', 'en', N'Unit Cost', 'manual');
-- 行.源单编号  ← 金蝶 inv_pick 行键 src_bill_no(实测非空 0/156)
IF COL_LENGTH('dbo.bl_material_out', N'源单编号') IS NULL ALTER TABLE dbo.bl_material_out ADD [源单编号] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'源单编号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'源单编号', N'源单编号', N'文本', N'detail', 1024, 120, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'源单编号' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'源单编号', 'en', N'Src Bill No', 'manual');
-- 行.源单类型id  ← 金蝶 inv_pick 行键 src_bill_type_id(实测非空 0/156)
IF COL_LENGTH('dbo.bl_material_out', N'源单类型id') IS NULL ALTER TABLE dbo.bl_material_out ADD [源单类型id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'源单类型id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'源单类型id', N'源单类型id', N'文本', N'detail', 1025, 120, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'源单类型id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'源单类型id', 'en', N'Src Bill Type Id', 'manual');
-- 行.源单类型名称  ← 金蝶 inv_pick 行键 src_bill_type_name(实测非空 0/156)
IF COL_LENGTH('dbo.bl_material_out', N'源单类型名称') IS NULL ALTER TABLE dbo.bl_material_out ADD [源单类型名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'源单类型名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'源单类型名称', N'源单类型名称', N'文本', N'detail', 1026, 120, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'源单类型名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'源单类型名称', 'en', N'Src Bill Type Name', 'manual');
-- 行.源单类型编码  ← 金蝶 inv_pick 行键 src_bill_type_number(实测非空 0/156)
IF COL_LENGTH('dbo.bl_material_out', N'源单类型编码') IS NULL ALTER TABLE dbo.bl_material_out ADD [源单类型编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'源单类型编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'源单类型编码', N'源单类型编码', N'文本', N'detail', 1027, 120, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'源单类型编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'源单类型编码', 'en', N'Src Bill Type Number', 'manual');
-- 行.源单内部id  ← 金蝶 inv_pick 行键 src_inter_id(实测非空 156/156)
IF COL_LENGTH('dbo.bl_material_out', N'源单内部id') IS NULL ALTER TABLE dbo.bl_material_out ADD [源单内部id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'源单内部id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'源单内部id', N'源单内部id', N'文本', N'detail', 1028, 120, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'源单内部id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'源单内部id', 'en', N'Src Inter Id', 'manual');
-- 行.源单日期  ← 金蝶 inv_pick 行键 src_bill_date(实测非空 0/156)
IF COL_LENGTH('dbo.bl_material_out', N'源单日期') IS NULL ALTER TABLE dbo.bl_material_out ADD [源单日期] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'源单日期')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'源单日期', N'源单日期', N'文本', N'detail', 1029, 120, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'源单日期' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'源单日期', 'en', N'Src Bill Date', 'manual');
-- 行.源单行号  ← 金蝶 inv_pick 行键 src_seq(实测非空 156/156)
IF COL_LENGTH('dbo.bl_material_out', N'源单行号') IS NULL ALTER TABLE dbo.bl_material_out ADD [源单行号] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'源单行号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'源单行号', N'源单行号', N'文本', N'detail', 1030, 120, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'源单行号' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'源单行号', 'en', N'Src Seq', 'manual');
-- 行.源单分录id  ← 金蝶 inv_pick 行键 src_entry_id(实测非空 156/156)
IF COL_LENGTH('dbo.bl_material_out', N'源单分录id') IS NULL ALTER TABLE dbo.bl_material_out ADD [源单分录id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'源单分录id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'源单分录id', N'源单分录id', N'文本', N'detail', 1031, 120, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'源单分录id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'源单分录id', 'en', N'Src Entry Id', 'manual');
-- 行.源单产品分录id  ← 金蝶 inv_pick 行键 src_product_entry_id(实测非空 156/156)
IF COL_LENGTH('dbo.bl_material_out', N'源单产品分录id') IS NULL ALTER TABLE dbo.bl_material_out ADD [源单产品分录id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'源单产品分录id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'源单产品分录id', N'源单产品分录id', N'文本', N'detail', 1032, 120, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'源单产品分录id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'源单产品分录id', 'en', N'Src Product Entry Id', 'manual');
GO

-- ══ 新增列中文注明(AGENTS.md:结构变更补注;幂等) ══
IF COL_LENGTH(N'dbo.bd_material_out', N'创建时间') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bd_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_out'), N'创建时间', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 create_time', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_out', N'COLUMN', N'创建时间';
IF COL_LENGTH(N'dbo.bd_material_out', N'单据状态_bill_status') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bd_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_out'), N'单据状态_bill_status', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 bill_status', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_out', N'COLUMN', N'单据状态_bill_status';
IF COL_LENGTH(N'dbo.bd_material_out', N'dept_id') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bd_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_out'), N'dept_id', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 dept_id', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_out', N'COLUMN', N'dept_id';
IF COL_LENGTH(N'dbo.bd_material_out', N'部门编码') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bd_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_out'), N'部门编码', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 dept_number', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_out', N'COLUMN', N'部门编码';
IF COL_LENGTH(N'dbo.bd_material_out', N'领料类型') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bd_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_out'), N'领料类型', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 pick_type', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_out', N'COLUMN', N'领料类型';
IF COL_LENGTH(N'dbo.bd_material_out', N'修改时间') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bd_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_out'), N'修改时间', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 modify_time', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_out', N'COLUMN', N'修改时间';
IF COL_LENGTH(N'dbo.bd_material_out', N'审核时间_audit_time') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bd_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_out'), N'审核时间_audit_time', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 audit_time', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_out', N'COLUMN', N'审核时间_audit_time';
IF COL_LENGTH(N'dbo.bd_material_out', N'creator_id') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bd_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_out'), N'creator_id', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 creator_id', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_out', N'COLUMN', N'creator_id';
IF COL_LENGTH(N'dbo.bd_material_out', N'创建人') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bd_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_out'), N'创建人', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 creator_name', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_out', N'COLUMN', N'创建人';
IF COL_LENGTH(N'dbo.bd_material_out', N'创建人编码') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bd_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_out'), N'创建人编码', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 creator_number', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_out', N'COLUMN', N'创建人编码';
IF COL_LENGTH(N'dbo.bd_material_out', N'modifier_id') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bd_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_out'), N'modifier_id', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 modifier_id', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_out', N'COLUMN', N'modifier_id';
IF COL_LENGTH(N'dbo.bd_material_out', N'修改人') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bd_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_out'), N'修改人', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 modifier_name', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_out', N'COLUMN', N'修改人';
IF COL_LENGTH(N'dbo.bd_material_out', N'修改人编码') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bd_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_out'), N'修改人编码', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 modifier_number', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_out', N'COLUMN', N'修改人编码';
IF COL_LENGTH(N'dbo.bd_material_out', N'单据类型名称') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bd_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_out'), N'单据类型名称', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 bill_type_name', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_out', N'COLUMN', N'单据类型名称';
IF COL_LENGTH(N'dbo.bd_material_out', N'单据类型编码') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bd_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_out'), N'单据类型编码', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 bill_type_number', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_out', N'COLUMN', N'单据类型编码';
IF COL_LENGTH(N'dbo.bd_material_out', N'bill_type_id') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bd_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_out'), N'bill_type_id', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 bill_type_id', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_out', N'COLUMN', N'bill_type_id';
IF COL_LENGTH(N'dbo.bd_material_out', N'auditor_id') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bd_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_out'), N'auditor_id', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 auditor_id', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_out', N'COLUMN', N'auditor_id';
IF COL_LENGTH(N'dbo.bd_material_out', N'审核人_auditor_name') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bd_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_out'), N'审核人_auditor_name', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 auditor_name', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_out', N'COLUMN', N'审核人_auditor_name';
IF COL_LENGTH(N'dbo.bd_material_out', N'审核人编码') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bd_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_out'), N'审核人编码', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 auditor_number', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_out', N'COLUMN', N'审核人编码';
IF COL_LENGTH(N'dbo.bd_material_out', N'emp_id') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bd_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_out'), N'emp_id', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 emp_id', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_out', N'COLUMN', N'emp_id';
IF COL_LENGTH(N'dbo.bd_material_out', N'经手人编码') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bd_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_out'), N'经手人编码', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 emp_number', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_out', N'COLUMN', N'经手人编码';
IF COL_LENGTH(N'dbo.bd_material_out', N'单据标签') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bd_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_out'), N'单据标签', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 mul_bill_label', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_out', N'COLUMN', N'单据标签';
IF COL_LENGTH(N'dbo.bd_material_out', N'领料用途名称') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bd_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_out'), N'领料用途名称', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 pick_use_name', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_out', N'COLUMN', N'领料用途名称';
IF COL_LENGTH(N'dbo.bd_material_out', N'pick_use_id') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bd_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_out'), N'pick_use_id', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 pick_use_id', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_out', N'COLUMN', N'pick_use_id';
IF COL_LENGTH(N'dbo.bd_material_out', N'领料用途编码') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bd_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_out'), N'领料用途编码', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 pick_use_number', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_out', N'COLUMN', N'领料用途编码';
IF COL_LENGTH(N'dbo.bl_material_out', N'图片') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bl_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_out'), N'图片', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 picture', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_out', N'COLUMN', N'图片';
IF COL_LENGTH(N'dbo.bl_material_out', N'行号') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bl_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_out'), N'行号', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 seq', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_out', N'COLUMN', N'行号';
IF COL_LENGTH(N'dbo.bl_material_out', N'商品id') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bl_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_out'), N'商品id', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 material_id', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_out', N'COLUMN', N'商品id';
IF COL_LENGTH(N'dbo.bl_material_out', N'商品是否多单位') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bl_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_out'), N'商品是否多单位', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 material_is_multi_unit', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_out', N'COLUMN', N'商品是否多单位';
IF COL_LENGTH(N'dbo.bl_material_out', N'商品是否序列号') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bl_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_out'), N'商品是否序列号', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 material_is_serial', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_out', N'COLUMN', N'商品是否序列号';
IF COL_LENGTH(N'dbo.bl_material_out', N'商品是否辅助属性') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bl_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_out'), N'商品是否辅助属性', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 material_is_asst_attr', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_out', N'COLUMN', N'商品是否辅助属性';
IF COL_LENGTH(N'dbo.bl_material_out', N'商品是否保质期') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bl_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_out'), N'商品是否保质期', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 material_is_kf_period', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_out', N'COLUMN', N'商品是否保质期';
IF COL_LENGTH(N'dbo.bl_material_out', N'商品是否批次') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bl_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_out'), N'商品是否批次', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 material_is_batch', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_out', N'COLUMN', N'商品是否批次';
IF COL_LENGTH(N'dbo.bl_material_out', N'仓库id') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bl_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_out'), N'仓库id', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 stock_id', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_out', N'COLUMN', N'仓库id';
IF COL_LENGTH(N'dbo.bl_material_out', N'仓库编码') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bl_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_out'), N'仓库编码', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 stock_number', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_out', N'COLUMN', N'仓库编码';
IF COL_LENGTH(N'dbo.bl_material_out', N'仓库启用仓位管理') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bl_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_out'), N'仓库启用仓位管理', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 stock_is_allow_freight', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_out', N'COLUMN', N'仓库启用仓位管理';
IF COL_LENGTH(N'dbo.bl_material_out', N'仓位id') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bl_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_out'), N'仓位id', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 sp_id', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_out', N'COLUMN', N'仓位id';
IF COL_LENGTH(N'dbo.bl_material_out', N'仓位名称') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bl_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_out'), N'仓位名称', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 sp_name', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_out', N'COLUMN', N'仓位名称';
IF COL_LENGTH(N'dbo.bl_material_out', N'仓位编码') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bl_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_out'), N'仓位编码', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 sp_number', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_out', N'COLUMN', N'仓位编码';
IF COL_LENGTH(N'dbo.bl_material_out', N'辅助属性id') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bl_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_out'), N'辅助属性id', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 aux_prop_id', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_out', N'COLUMN', N'辅助属性id';
IF COL_LENGTH(N'dbo.bl_material_out', N'辅助属性名称') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bl_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_out'), N'辅助属性名称', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 aux_prop_name', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_out', N'COLUMN', N'辅助属性名称';
IF COL_LENGTH(N'dbo.bl_material_out', N'辅助属性编码') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bl_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_out'), N'辅助属性编码', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 aux_prop_number', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_out', N'COLUMN', N'辅助属性编码';
IF COL_LENGTH(N'dbo.bl_material_out', N'辅助属性1id') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bl_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_out'), N'辅助属性1id', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 aux1_id', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_out', N'COLUMN', N'辅助属性1id';
IF COL_LENGTH(N'dbo.bl_material_out', N'辅助属性1名称') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bl_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_out'), N'辅助属性1名称', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 aux1_name', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_out', N'COLUMN', N'辅助属性1名称';
IF COL_LENGTH(N'dbo.bl_material_out', N'辅助属性1编码') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bl_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_out'), N'辅助属性1编码', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 aux1_number', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_out', N'COLUMN', N'辅助属性1编码';
IF COL_LENGTH(N'dbo.bl_material_out', N'辅助属性2id') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bl_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_out'), N'辅助属性2id', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 aux2_id', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_out', N'COLUMN', N'辅助属性2id';
IF COL_LENGTH(N'dbo.bl_material_out', N'辅助属性2名称') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bl_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_out'), N'辅助属性2名称', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 aux2_name', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_out', N'COLUMN', N'辅助属性2名称';
IF COL_LENGTH(N'dbo.bl_material_out', N'辅助属性2编码') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bl_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_out'), N'辅助属性2编码', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 aux2_number', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_out', N'COLUMN', N'辅助属性2编码';
IF COL_LENGTH(N'dbo.bl_material_out', N'辅助属性3id') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bl_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_out'), N'辅助属性3id', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 aux3_id', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_out', N'COLUMN', N'辅助属性3id';
IF COL_LENGTH(N'dbo.bl_material_out', N'辅助属性3名称') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bl_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_out'), N'辅助属性3名称', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 aux3_name', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_out', N'COLUMN', N'辅助属性3名称';
IF COL_LENGTH(N'dbo.bl_material_out', N'辅助属性3编码') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bl_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_out'), N'辅助属性3编码', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 aux3_number', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_out', N'COLUMN', N'辅助属性3编码';
IF COL_LENGTH(N'dbo.bl_material_out', N'条形码') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bl_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_out'), N'条形码', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 barcode', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_out', N'COLUMN', N'条形码';
IF COL_LENGTH(N'dbo.bl_material_out', N'产地') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bl_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_out'), N'产地', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 pro_place', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_out', N'COLUMN', N'产地';
IF COL_LENGTH(N'dbo.bl_material_out', N'注册证号') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bl_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_out'), N'注册证号', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 pro_reg_no', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_out', N'COLUMN', N'注册证号';
IF COL_LENGTH(N'dbo.bl_material_out', N'生产许可证') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bl_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_out'), N'生产许可证', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 pro_license', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_out', N'COLUMN', N'生产许可证';
IF COL_LENGTH(N'dbo.bl_material_out', N'保质期到期日') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bl_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_out'), N'保质期到期日', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 kf_date', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_out', N'COLUMN', N'保质期到期日';
IF COL_LENGTH(N'dbo.bl_material_out', N'有效期至') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bl_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_out'), N'有效期至', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 valid_date', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_out', N'COLUMN', N'有效期至';
IF COL_LENGTH(N'dbo.bl_material_out', N'保质期类型') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bl_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_out'), N'保质期类型', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 kf_type', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_out', N'COLUMN', N'保质期类型';
IF COL_LENGTH(N'dbo.bl_material_out', N'保质期') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bl_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_out'), N'保质期', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 kf_period', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_out', N'COLUMN', N'保质期';
IF COL_LENGTH(N'dbo.bl_material_out', N'序列号清单') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bl_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_out'), N'序列号清单', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 sn_list', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_out', N'COLUMN', N'序列号清单';
IF COL_LENGTH(N'dbo.bl_material_out', N'序列号流转ID') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bl_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_out'), N'序列号流转ID', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 sn_list_id', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_out', N'COLUMN', N'序列号流转ID';
IF COL_LENGTH(N'dbo.bl_material_out', N'基本单位id') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bl_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_out'), N'基本单位id', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 base_unit_id', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_out', N'COLUMN', N'基本单位id';
IF COL_LENGTH(N'dbo.bl_material_out', N'基本单位名称') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bl_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_out'), N'基本单位名称', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 base_unit_name', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_out', N'COLUMN', N'基本单位名称';
IF COL_LENGTH(N'dbo.bl_material_out', N'基本单位编码') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bl_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_out'), N'基本单位编码', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 base_unit_number', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_out', N'COLUMN', N'基本单位编码';
IF COL_LENGTH(N'dbo.bl_material_out', N'单位id') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bl_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_out'), N'单位id', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 unit_id', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_out', N'COLUMN', N'单位id';
IF COL_LENGTH(N'dbo.bl_material_out', N'单位编码') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bl_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_out'), N'单位编码', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 unit_number', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_out', N'COLUMN', N'单位编码';
IF COL_LENGTH(N'dbo.bl_material_out', N'辅助单位id') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bl_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_out'), N'辅助单位id', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 aux_unit_id', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_out', N'COLUMN', N'辅助单位id';
IF COL_LENGTH(N'dbo.bl_material_out', N'辅助单位名称') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bl_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_out'), N'辅助单位名称', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 aux_unit_name', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_out', N'COLUMN', N'辅助单位名称';
IF COL_LENGTH(N'dbo.bl_material_out', N'辅助单位编码') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bl_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_out'), N'辅助单位编码', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 aux_unit_number', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_out', N'COLUMN', N'辅助单位编码';
IF COL_LENGTH(N'dbo.bl_material_out', N'换算率') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bl_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_out'), N'换算率', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 conversion_rate', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_out', N'COLUMN', N'换算率';
IF COL_LENGTH(N'dbo.bl_material_out', N'库存数量') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bl_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_out'), N'库存数量', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 inv_qty', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_out', N'COLUMN', N'库存数量';
IF COL_LENGTH(N'dbo.bl_material_out', N'基本数量') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bl_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_out'), N'基本数量', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 base_qty', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_out', N'COLUMN', N'基本数量';
IF COL_LENGTH(N'dbo.bl_material_out', N'库存基本数量') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bl_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_out'), N'库存基本数量', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 inv_base_qty', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_out', N'COLUMN', N'库存基本数量';
IF COL_LENGTH(N'dbo.bl_material_out', N'辅助数量') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bl_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_out'), N'辅助数量', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 aux_qty', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_out', N'COLUMN', N'辅助数量';
IF COL_LENGTH(N'dbo.bl_material_out', N'默认浮动数量') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bl_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_out'), N'默认浮动数量', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 def_float_qty', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_out', N'COLUMN', N'默认浮动数量';
IF COL_LENGTH(N'dbo.bl_material_out', N'辅助换算系数') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bl_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_out'), N'辅助换算系数', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 aux_coefficient', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_out', N'COLUMN', N'辅助换算系数';
IF COL_LENGTH(N'dbo.bl_material_out', N'换算系数') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bl_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_out'), N'换算系数', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 coefficient', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_out', N'COLUMN', N'换算系数';
IF COL_LENGTH(N'dbo.bl_material_out', N'成本') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bl_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_out'), N'成本', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 cost', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_out', N'COLUMN', N'成本';
IF COL_LENGTH(N'dbo.bl_material_out', N'单位成本') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bl_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_out'), N'单位成本', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 unit_cost', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_out', N'COLUMN', N'单位成本';
IF COL_LENGTH(N'dbo.bl_material_out', N'源单编号') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bl_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_out'), N'源单编号', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 src_bill_no', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_out', N'COLUMN', N'源单编号';
IF COL_LENGTH(N'dbo.bl_material_out', N'源单类型id') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bl_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_out'), N'源单类型id', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 src_bill_type_id', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_out', N'COLUMN', N'源单类型id';
IF COL_LENGTH(N'dbo.bl_material_out', N'源单类型名称') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bl_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_out'), N'源单类型名称', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 src_bill_type_name', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_out', N'COLUMN', N'源单类型名称';
IF COL_LENGTH(N'dbo.bl_material_out', N'源单类型编码') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bl_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_out'), N'源单类型编码', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 src_bill_type_number', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_out', N'COLUMN', N'源单类型编码';
IF COL_LENGTH(N'dbo.bl_material_out', N'源单内部id') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bl_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_out'), N'源单内部id', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 src_inter_id', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_out', N'COLUMN', N'源单内部id';
IF COL_LENGTH(N'dbo.bl_material_out', N'源单日期') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bl_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_out'), N'源单日期', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 src_bill_date', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_out', N'COLUMN', N'源单日期';
IF COL_LENGTH(N'dbo.bl_material_out', N'源单行号') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bl_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_out'), N'源单行号', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 src_seq', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_out', N'COLUMN', N'源单行号';
IF COL_LENGTH(N'dbo.bl_material_out', N'源单分录id') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bl_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_out'), N'源单分录id', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 src_entry_id', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_out', N'COLUMN', N'源单分录id';
IF COL_LENGTH(N'dbo.bl_material_out', N'源单产品分录id') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bl_material_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_out'), N'源单产品分录id', 'ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 src_product_entry_id', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_out', N'COLUMN', N'源单产品分录id';
GO

PRINT N'migrate-material-out-fields 完成';
GO