-- migrate-kingdee-full-union.sql — 面板字段与「文档并集(列表∪详情)」完全对应
-- 生成器:tools/archive/_gen-full-union.mjs(访问记录哨兵自动求差集;标签取面板字段对照.md 说明列)
-- 敏感键走解密(dec);数组键拼接 JSON(join);其余文本。订单头键 place=header。
USE HSDZ_MES;
SET NOCOUNT ON;
GO

-- ══ CUR(BD_CUR→bs_currency):并集 15 键,补 2 ══
IF COL_LENGTH('dbo.bs_currency', N'创建人id') IS NULL ALTER TABLE dbo.bs_currency ADD [创建人id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='CUR' AND col_name=N'创建人id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('CUR', N'创建人id', N'创建人id', N'文本', N'detail', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'创建人id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'创建人id', 'en', N'Creator Id', 'manual');
IF COL_LENGTH('dbo.bs_currency', N'修改人id') IS NULL ALTER TABLE dbo.bs_currency ADD [修改人id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='CUR' AND col_name=N'修改人id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('CUR', N'修改人id', N'修改人id', N'文本', N'detail', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'修改人id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'修改人id', 'en', N'Modifier Id', 'manual');
GO

-- ══ UOM(BD_UOM→bs_uom):并集 14 键,补 2 ══
IF COL_LENGTH('dbo.bs_uom', N'创建人') IS NULL ALTER TABLE dbo.bs_uom ADD [创建人] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='UOM' AND col_name=N'创建人')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('UOM', N'创建人', N'创建人', N'文本', N'detail', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'创建人' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'创建人', 'en', N'Creator Id', 'manual');
IF COL_LENGTH('dbo.bs_uom', N'修改人') IS NULL ALTER TABLE dbo.bs_uom ADD [修改人] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='UOM' AND col_name=N'修改人')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('UOM', N'修改人', N'修改人', N'文本', N'detail', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'修改人' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'修改人', 'en', N'Modifier Id', 'manual');
GO

-- ══ DEPT(BD_DEPT→bs_dept):并集 12 键,补 1 ══
IF COL_LENGTH('dbo.bs_dept', N'上级id') IS NULL ALTER TABLE dbo.bs_dept ADD [上级id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='DEPT' AND col_name=N'上级id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('DEPT', N'上级id', N'上级id', N'文本', N'detail', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'上级id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'上级id', 'en', N'Parent Id', 'manual');
GO

-- ══ EMP(BD_EMP→bs_emp):并集 17 键,补 3 ══
IF COL_LENGTH('dbo.bs_emp', N'部门id') IS NULL ALTER TABLE dbo.bs_emp ADD [部门id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='EMP' AND col_name=N'部门id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('EMP', N'部门id', N'部门id', N'文本', N'detail', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'部门id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'部门id', 'en', N'Department Id', 'manual');
IF COL_LENGTH('dbo.bs_emp', N'结算账户id') IS NULL ALTER TABLE dbo.bs_emp ADD [结算账户id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='EMP' AND col_name=N'结算账户id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('EMP', N'结算账户id', N'结算账户id', N'文本', N'detail', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'结算账户id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'结算账户id', 'en', N'Settle Bank Id', 'manual');
IF COL_LENGTH('dbo.bs_emp', N'结算类型id') IS NULL ALTER TABLE dbo.bs_emp ADD [结算类型id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='EMP' AND col_name=N'结算类型id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('EMP', N'结算类型id', N'结算类型id', N'文本', N'detail', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'结算类型id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'结算类型id', 'en', N'Settle Type Id', 'manual');
GO

-- ══ WH(BD_STORE→bs_wh):并集 19 键,补 2 ══
IF COL_LENGTH('dbo.bs_wh', N'分类id') IS NULL ALTER TABLE dbo.bs_wh ADD [分类id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WH' AND col_name=N'分类id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('WH', N'分类id', N'分类id', N'文本', N'detail', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'分类id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'分类id', 'en', N'Group Id', 'manual');
IF COL_LENGTH('dbo.bs_wh', N'仓库管理员id') IS NULL ALTER TABLE dbo.bs_wh ADD [仓库管理员id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WH' AND col_name=N'仓库管理员id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('WH', N'仓库管理员id', N'仓库管理员id', N'文本', N'detail', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'仓库管理员id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'仓库管理员id', 'en', N'Storekeeper Id', 'manual');
GO

-- ══ INV(BD_MATERIAL→bs_inv):并集 95 键,补 33 ══
IF COL_LENGTH('dbo.bs_inv', N'parent_name') IS NULL ALTER TABLE dbo.bs_inv ADD [parent_name] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'parent_name')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'parent_name', N'parent_name', N'文本', N'detail', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'parent_name' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'parent_name', 'en', N'Parent Name', 'manual');
IF COL_LENGTH('dbo.bs_inv', N'商品类别编码') IS NULL ALTER TABLE dbo.bs_inv ADD [商品类别编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'商品类别编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'商品类别编码', N'商品类别编码', N'文本', N'detail', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'商品类别编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'商品类别编码', 'en', N'Parent Number', 'manual');
IF COL_LENGTH('dbo.bs_inv', N'is_show_aux_barcode') IS NULL ALTER TABLE dbo.bs_inv ADD [is_show_aux_barcode] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'is_show_aux_barcode')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'is_show_aux_barcode', N'is_show_aux_barcode', N'文本', N'detail', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'is_show_aux_barcode' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'is_show_aux_barcode', 'en', N'Is Show Aux Barcode', 'manual');
IF COL_LENGTH('dbo.bs_inv', N'品牌id') IS NULL ALTER TABLE dbo.bs_inv ADD [品牌id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'品牌id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'品牌id', N'品牌id', N'文本', N'detail', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'品牌id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'品牌id', 'en', N'Brand Id', 'manual');
IF COL_LENGTH('dbo.bs_inv', N'商品计量单位id') IS NULL ALTER TABLE dbo.bs_inv ADD [商品计量单位id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'商品计量单位id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'商品计量单位id', N'商品计量单位id', N'文本', N'detail', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'商品计量单位id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'商品计量单位id', 'en', N'Base Unit Id', 'manual');
IF COL_LENGTH('dbo.bs_inv', N'默认仓库_stock_id') IS NULL ALTER TABLE dbo.bs_inv ADD [默认仓库_stock_id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'默认仓库_stock_id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'默认仓库_stock_id', N'默认仓库_stock_id', N'文本', N'detail', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'默认仓库_stock_id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'默认仓库_stock_id', 'en', N'Stock Id', 'manual');
IF COL_LENGTH('dbo.bs_inv', N'采购单位') IS NULL ALTER TABLE dbo.bs_inv ADD [采购单位] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'采购单位')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'采购单位', N'采购单位', N'文本', N'detail', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'采购单位' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'采购单位', 'en', N'Purchase Unit Id', 'manual');
IF COL_LENGTH('dbo.bs_inv', N'辅助单位1,启动多单位，才需要传递') IS NULL ALTER TABLE dbo.bs_inv ADD [辅助单位1,启动多单位，才需要传递] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'辅助单位1,启动多单位，才需要传递')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'辅助单位1,启动多单位，才需要传递', N'辅助单位1,启动多单位，才需要传递', N'文本', N'detail', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助单位1,启动多单位，才需要传递' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助单位1,启动多单位，才需要传递', 'en', N'Fix Unit Id1', 'manual');
IF COL_LENGTH('dbo.bs_inv', N'换算率1') IS NULL ALTER TABLE dbo.bs_inv ADD [换算率1] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'换算率1')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'换算率1', N'换算率1', N'文本', N'detail', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'换算率1' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'换算率1', 'en', N'Coefficient1', 'manual');
IF COL_LENGTH('dbo.bs_inv', N'换算单位1') IS NULL ALTER TABLE dbo.bs_inv ADD [换算单位1] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'换算单位1')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'换算单位1', N'换算单位1', N'文本', N'detail', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'换算单位1' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'换算单位1', 'en', N'Conversion Unit Id1', 'manual');
IF COL_LENGTH('dbo.bs_inv', N'辅助单位2') IS NULL ALTER TABLE dbo.bs_inv ADD [辅助单位2] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'辅助单位2')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'辅助单位2', N'辅助单位2', N'文本', N'detail', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助单位2' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助单位2', 'en', N'Fix Unit Id2', 'manual');
IF COL_LENGTH('dbo.bs_inv', N'换算率2') IS NULL ALTER TABLE dbo.bs_inv ADD [换算率2] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'换算率2')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'换算率2', N'换算率2', N'文本', N'detail', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'换算率2' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'换算率2', 'en', N'Coefficient2', 'manual');
IF COL_LENGTH('dbo.bs_inv', N'换算单位2') IS NULL ALTER TABLE dbo.bs_inv ADD [换算单位2] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'换算单位2')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'换算单位2', N'换算单位2', N'文本', N'detail', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'换算单位2' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'换算单位2', 'en', N'Conversion Unit Id2', 'manual');
IF COL_LENGTH('dbo.bs_inv', N'辅助单位3') IS NULL ALTER TABLE dbo.bs_inv ADD [辅助单位3] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'辅助单位3')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'辅助单位3', N'辅助单位3', N'文本', N'detail', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助单位3' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助单位3', 'en', N'Fix Unit Id3', 'manual');
IF COL_LENGTH('dbo.bs_inv', N'换算率3') IS NULL ALTER TABLE dbo.bs_inv ADD [换算率3] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'换算率3')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'换算率3', N'换算率3', N'文本', N'detail', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'换算率3' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'换算率3', 'en', N'Coefficient3', 'manual');
IF COL_LENGTH('dbo.bs_inv', N'换算单位3') IS NULL ALTER TABLE dbo.bs_inv ADD [换算单位3] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'换算单位3')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'换算单位3', N'换算单位3', N'文本', N'detail', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'换算单位3' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'换算单位3', 'en', N'Conversion Unit Id3', 'manual');
IF COL_LENGTH('dbo.bs_inv', N'销售单位') IS NULL ALTER TABLE dbo.bs_inv ADD [销售单位] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'销售单位')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'销售单位', N'销售单位', N'文本', N'detail', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'销售单位' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'销售单位', 'en', N'Sale Unit Id', 'manual');
IF COL_LENGTH('dbo.bs_inv', N'库存单位') IS NULL ALTER TABLE dbo.bs_inv ADD [库存单位] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'库存单位')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'库存单位', N'库存单位', N'文本', N'detail', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'库存单位' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'库存单位', 'en', N'Store Unit Id', 'manual');
IF COL_LENGTH('dbo.bs_inv', N'报表辅助单位') IS NULL ALTER TABLE dbo.bs_inv ADD [报表辅助单位] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'报表辅助单位')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'报表辅助单位', N'报表辅助单位', N'文本', N'detail', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'报表辅助单位' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'报表辅助单位', 'en', N'Aux Unit Id', 'manual');
IF COL_LENGTH('dbo.bs_inv', N'辅助属性') IS NULL ALTER TABLE dbo.bs_inv ADD [辅助属性] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'辅助属性')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'辅助属性', N'辅助属性', N'文本', N'detail', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助属性' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助属性', 'en', N'Aux Entity', 'manual');
IF COL_LENGTH('dbo.bs_inv', N'商品条码') IS NULL ALTER TABLE dbo.bs_inv ADD [商品条码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'商品条码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'商品条码', N'商品条码', N'文本', N'detail', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'商品条码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'商品条码', 'en', N'Barcode Entity', 'manual');
IF COL_LENGTH('dbo.bs_inv', N'税收分类编码') IS NULL ALTER TABLE dbo.bs_inv ADD [税收分类编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'税收分类编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'税收分类编码', N'税收分类编码', N'文本', N'detail', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'税收分类编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'税收分类编码', 'en', N'Fetch Category Id', 'manual');
IF COL_LENGTH('dbo.bs_inv', N'默认仓位') IS NULL ALTER TABLE dbo.bs_inv ADD [默认仓位] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'默认仓位')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'默认仓位', N'默认仓位', N'文本', N'detail', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'默认仓位' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'默认仓位', 'en', N'Space Id', 'manual');
IF COL_LENGTH('dbo.bs_inv', N'默认供应商') IS NULL ALTER TABLE dbo.bs_inv ADD [默认供应商] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'默认供应商')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'默认供应商', N'默认供应商', N'文本', N'detail', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'默认供应商' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'默认供应商', 'en', N'Vender Id', 'manual');
IF COL_LENGTH('dbo.bs_inv', N'采购员') IS NULL ALTER TABLE dbo.bs_inv ADD [采购员] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'采购员')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'采购员', N'采购员', N'文本', N'detail', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'采购员' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'采购员', 'en', N'Purchase Id', 'manual');
IF COL_LENGTH('dbo.bs_inv', N'重量单位') IS NULL ALTER TABLE dbo.bs_inv ADD [重量单位] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'重量单位')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'重量单位', N'重量单位', N'文本', N'detail', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'重量单位' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'重量单位', 'en', N'Weight Unit Id', 'manual');
IF COL_LENGTH('dbo.bs_inv', N'商品图片') IS NULL ALTER TABLE dbo.bs_inv ADD [商品图片] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'商品图片')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'商品图片', N'商品图片', N'文本', N'detail', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'商品图片' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'商品图片', 'en', N'Images', 'manual');
IF COL_LENGTH('dbo.bs_inv', N'套装信息对象') IS NULL ALTER TABLE dbo.bs_inv ADD [套装信息对象] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'套装信息对象')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'套装信息对象', N'套装信息对象', N'文本', N'detail', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'套装信息对象' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'套装信息对象', 'en', N'Bom Entity', 'manual');
IF COL_LENGTH('dbo.bs_inv', N'附件地址') IS NULL ALTER TABLE dbo.bs_inv ADD [附件地址] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'附件地址')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'附件地址', N'附件地址', N'文本', N'detail', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'附件地址' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'附件地址', 'en', N'Attachments Url', 'manual');
IF COL_LENGTH('dbo.bs_inv', N'默认生产车间id') IS NULL ALTER TABLE dbo.bs_inv ADD [默认生产车间id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'默认生产车间id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'默认生产车间id', N'默认生产车间id', N'文本', N'detail', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'默认生产车间id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'默认生产车间id', 'en', N'Product Department Id', 'manual');
IF COL_LENGTH('dbo.bs_inv', N'倒冲仓库id') IS NULL ALTER TABLE dbo.bs_inv ADD [倒冲仓库id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'倒冲仓库id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'倒冲仓库id', N'倒冲仓库id', N'文本', N'detail', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'倒冲仓库id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'倒冲仓库id', 'en', N'Backflushed Stock Id', 'manual');
IF COL_LENGTH('dbo.bs_inv', N'倒冲仓位id') IS NULL ALTER TABLE dbo.bs_inv ADD [倒冲仓位id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'倒冲仓位id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'倒冲仓位id', N'倒冲仓位id', N'文本', N'detail', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'倒冲仓位id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'倒冲仓位id', 'en', N'Backflushed Space Id', 'manual');
IF COL_LENGTH('dbo.bs_inv', N'倒冲仓位编码') IS NULL ALTER TABLE dbo.bs_inv ADD [倒冲仓位编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'倒冲仓位编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'倒冲仓位编码', N'倒冲仓位编码', N'文本', N'detail', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'倒冲仓位编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'倒冲仓位编码', 'en', N'Backflushed Space Number', 'manual');
GO

-- ══ KHDA(BD_CUSTOMER→dm_kh):并集 52 键,补 10 ══
IF COL_LENGTH('dbo.dm_kh', N'价格等级-id') IS NULL ALTER TABLE dbo.dm_kh ADD [价格等级-id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='KHDA' AND col_name=N'价格等级-id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('KHDA', N'价格等级-id', N'价格等级-id', N'文本', N'detail', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'价格等级-id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'价格等级-id', 'en', N'C Level Id', 'manual');
IF COL_LENGTH('dbo.dm_kh', N'国家-id') IS NULL ALTER TABLE dbo.dm_kh ADD [国家-id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='KHDA' AND col_name=N'国家-id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('KHDA', N'国家-id', N'国家-id', N'文本', N'detail', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'国家-id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'国家-id', 'en', N'Country Id', 'manual');
IF COL_LENGTH('dbo.dm_kh', N'省-id') IS NULL ALTER TABLE dbo.dm_kh ADD [省-id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='KHDA' AND col_name=N'省-id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('KHDA', N'省-id', N'省-id', N'文本', N'detail', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'省-id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'省-id', 'en', N'Province Id', 'manual');
IF COL_LENGTH('dbo.dm_kh', N'市-id') IS NULL ALTER TABLE dbo.dm_kh ADD [市-id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='KHDA' AND col_name=N'市-id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('KHDA', N'市-id', N'市-id', N'文本', N'detail', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'市-id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'市-id', 'en', N'City Id', 'manual');
IF COL_LENGTH('dbo.dm_kh', N'区-id') IS NULL ALTER TABLE dbo.dm_kh ADD [区-id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='KHDA' AND col_name=N'区-id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('KHDA', N'区-id', N'区-id', N'文本', N'detail', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'区-id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'区-id', 'en', N'District Id', 'manual');
IF COL_LENGTH('dbo.dm_kh', N'部门-id') IS NULL ALTER TABLE dbo.dm_kh ADD [部门-id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='KHDA' AND col_name=N'部门-id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('KHDA', N'部门-id', N'部门-id', N'文本', N'detail', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'部门-id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'部门-id', 'en', N'Sale Dept Id', 'manual');
IF COL_LENGTH('dbo.dm_kh', N'类别-id') IS NULL ALTER TABLE dbo.dm_kh ADD [类别-id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='KHDA' AND col_name=N'类别-id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('KHDA', N'类别-id', N'类别-id', N'文本', N'detail', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'类别-id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'类别-id', 'en', N'Group Id', 'manual');
IF COL_LENGTH('dbo.dm_kh', N'业务员-id') IS NULL ALTER TABLE dbo.dm_kh ADD [业务员-id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='KHDA' AND col_name=N'业务员-id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('KHDA', N'业务员-id', N'业务员-id', N'文本', N'detail', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'业务员-id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'业务员-id', 'en', N'Saler Id', 'manual');
IF COL_LENGTH('dbo.dm_kh', N'结算期限id') IS NULL ALTER TABLE dbo.dm_kh ADD [结算期限id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='KHDA' AND col_name=N'结算期限id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('KHDA', N'结算期限id', N'结算期限id', N'文本', N'detail', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'结算期限id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'结算期限id', 'en', N'Setting Term Id', 'manual');
IF COL_LENGTH('dbo.dm_kh', N'结算客户id') IS NULL ALTER TABLE dbo.dm_kh ADD [结算客户id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='KHDA' AND col_name=N'结算客户id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('KHDA', N'结算客户id', N'结算客户id', N'文本', N'detail', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'结算客户id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'结算客户id', 'en', N'Settle Customer Id', 'manual');
GO

-- ══ GFDA(BD_SUPPLIER→dm_gf):并集 20 键,补 1 ══
IF COL_LENGTH('dbo.dm_gf', N'group_id') IS NULL ALTER TABLE dbo.dm_gf ADD [group_id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='GFDA' AND col_name=N'group_id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('GFDA', N'group_id', N'group_id', N'文本', N'detail', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'group_id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'group_id', 'en', N'Group Id', 'manual');
GO

-- ══ SO_ORDER(SO_ORDER→bd_so_order):并集 101 键,补 83 ══
IF COL_LENGTH('dbo.bd_so_order', N'整单折扣额') IS NULL ALTER TABLE dbo.bd_so_order ADD [整单折扣额] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'整单折扣额')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'整单折扣额', N'整单折扣额', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'整单折扣额' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'整单折扣额', 'en', N'Bill Dis Amount', 'manual');
IF COL_LENGTH('dbo.bd_so_order', N'创建时间') IS NULL ALTER TABLE dbo.bd_so_order ADD [创建时间] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'创建时间')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'创建时间', N'创建时间', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'创建时间' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'创建时间', 'en', N'Create Time', 'manual');
IF COL_LENGTH('dbo.bd_so_order', N'结算状态') IS NULL ALTER TABLE dbo.bd_so_order ADD [结算状态] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'结算状态')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'结算状态', N'结算状态', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'结算状态' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'结算状态', 'en', N'Settle Status', 'manual');
IF COL_LENGTH('dbo.bd_so_order', N'交货方式') IS NULL ALTER TABLE dbo.bd_so_order ADD [交货方式] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'交货方式')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'交货方式', N'交货方式', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'交货方式' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'交货方式', 'en', N'Delivery Type', 'manual');
IF COL_LENGTH('dbo.bd_so_order', N'客户id') IS NULL ALTER TABLE dbo.bd_so_order ADD [客户id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'客户id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'客户id', N'客户id', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'客户id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'客户id', 'en', N'Customer Id', 'manual');
IF COL_LENGTH('dbo.bd_so_order', N'业务员id') IS NULL ALTER TABLE dbo.bd_so_order ADD [业务员id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'业务员id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'业务员id', N'业务员id', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'业务员id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'业务员id', 'en', N'Emp Id', 'manual');
IF COL_LENGTH('dbo.bd_so_order', N'业务员编码') IS NULL ALTER TABLE dbo.bd_so_order ADD [业务员编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'业务员编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'业务员编码', N'业务员编码', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'业务员编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'业务员编码', 'en', N'Emp Number', 'manual');
IF COL_LENGTH('dbo.bd_so_order', N'应收金额') IS NULL ALTER TABLE dbo.bd_so_order ADD [应收金额] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'应收金额')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'应收金额', N'应收金额', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'应收金额' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'应收金额', 'en', N'Total Amount', 'manual');
IF COL_LENGTH('dbo.bd_so_order', N'商品组合') IS NULL ALTER TABLE dbo.bd_so_order ADD [商品组合] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'商品组合')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'商品组合', N'商品组合', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'商品组合' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'商品组合', 'en', N'Material Group', 'manual');
IF COL_LENGTH('dbo.bd_so_order', N'商品数量') IS NULL ALTER TABLE dbo.bd_so_order ADD [商品数量] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'商品数量')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'商品数量', N'商品数量', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'商品数量' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'商品数量', 'en', N'Material Qty', 'manual');
IF COL_LENGTH('dbo.bd_so_order', N'单据整单折前价税合计') IS NULL ALTER TABLE dbo.bd_so_order ADD [单据整单折前价税合计] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'单据整单折前价税合计')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'单据整单折前价税合计', N'单据整单折前价税合计', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'单据整单折前价税合计' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'单据整单折前价税合计', 'en', N'Bill Dis Before Amount', 'manual');
IF COL_LENGTH('dbo.bd_so_order', N'实际出入库状态') IS NULL ALTER TABLE dbo.bd_so_order ADD [实际出入库状态] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'实际出入库状态')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'实际出入库状态', N'实际出入库状态', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'实际出入库状态' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'实际出入库状态', 'en', N'Real Io Status', 'manual');
IF COL_LENGTH('dbo.bd_so_order', N'出入库状态') IS NULL ALTER TABLE dbo.bd_so_order ADD [出入库状态] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'出入库状态')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'出入库状态', N'出入库状态', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'出入库状态' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'出入库状态', 'en', N'Io Status', 'manual');
IF COL_LENGTH('dbo.bd_so_order', N'单据关闭状态') IS NULL ALTER TABLE dbo.bd_so_order ADD [单据关闭状态] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'单据关闭状态')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'单据关闭状态', N'单据关闭状态', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'单据关闭状态' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'单据关闭状态', 'en', N'Bill Close State', 'manual');
IF COL_LENGTH('dbo.bd_so_order', N'部门id') IS NULL ALTER TABLE dbo.bd_so_order ADD [部门id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'部门id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'部门id', N'部门id', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'部门id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'部门id', 'en', N'Dept Id', 'manual');
IF COL_LENGTH('dbo.bd_so_order', N'部门编码') IS NULL ALTER TABLE dbo.bd_so_order ADD [部门编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'部门编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'部门编码', N'部门编码', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'部门编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'部门编码', 'en', N'Dept Number', 'manual');
IF COL_LENGTH('dbo.bd_so_order', N'审核日期') IS NULL ALTER TABLE dbo.bd_so_order ADD [审核日期] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'审核日期')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'审核日期', N'审核日期', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'审核日期' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'审核日期', 'en', N'Audit Date', 'manual');
IF COL_LENGTH('dbo.bd_so_order', N'客户联系电话') IS NULL ALTER TABLE dbo.bd_so_order ADD [客户联系电话] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'客户联系电话')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'客户联系电话', N'客户联系电话', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'客户联系电话' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'客户联系电话', 'en', N'Contact Phone', 'manual');
IF COL_LENGTH('dbo.bd_so_order', N'客户国家id') IS NULL ALTER TABLE dbo.bd_so_order ADD [客户国家id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'客户国家id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'客户国家id', N'客户国家id', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'客户国家id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'客户国家id', 'en', N'Contact Country Id', 'manual');
IF COL_LENGTH('dbo.bd_so_order', N'客户国家名称') IS NULL ALTER TABLE dbo.bd_so_order ADD [客户国家名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'客户国家名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'客户国家名称', N'客户国家名称', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'客户国家名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'客户国家名称', 'en', N'Contact Country Name', 'manual');
IF COL_LENGTH('dbo.bd_so_order', N'客户国家编码') IS NULL ALTER TABLE dbo.bd_so_order ADD [客户国家编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'客户国家编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'客户国家编码', N'客户国家编码', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'客户国家编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'客户国家编码', 'en', N'Contact Country Number', 'manual');
IF COL_LENGTH('dbo.bd_so_order', N'客户省份id') IS NULL ALTER TABLE dbo.bd_so_order ADD [客户省份id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'客户省份id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'客户省份id', N'客户省份id', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'客户省份id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'客户省份id', 'en', N'Contact Province Id', 'manual');
IF COL_LENGTH('dbo.bd_so_order', N'客户省份名称') IS NULL ALTER TABLE dbo.bd_so_order ADD [客户省份名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'客户省份名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'客户省份名称', N'客户省份名称', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'客户省份名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'客户省份名称', 'en', N'Contact Province Name', 'manual');
IF COL_LENGTH('dbo.bd_so_order', N'客户省份编码') IS NULL ALTER TABLE dbo.bd_so_order ADD [客户省份编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'客户省份编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'客户省份编码', N'客户省份编码', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'客户省份编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'客户省份编码', 'en', N'Contact Province Number', 'manual');
IF COL_LENGTH('dbo.bd_so_order', N'客户市区id') IS NULL ALTER TABLE dbo.bd_so_order ADD [客户市区id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'客户市区id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'客户市区id', N'客户市区id', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'客户市区id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'客户市区id', 'en', N'Contact City Id', 'manual');
IF COL_LENGTH('dbo.bd_so_order', N'客户市区名称') IS NULL ALTER TABLE dbo.bd_so_order ADD [客户市区名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'客户市区名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'客户市区名称', N'客户市区名称', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'客户市区名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'客户市区名称', 'en', N'Contact City Name', 'manual');
IF COL_LENGTH('dbo.bd_so_order', N'客户市区编码') IS NULL ALTER TABLE dbo.bd_so_order ADD [客户市区编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'客户市区编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'客户市区编码', N'客户市区编码', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'客户市区编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'客户市区编码', 'en', N'Contact City Number', 'manual');
IF COL_LENGTH('dbo.bd_so_order', N'客户区县id') IS NULL ALTER TABLE dbo.bd_so_order ADD [客户区县id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'客户区县id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'客户区县id', N'客户区县id', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'客户区县id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'客户区县id', 'en', N'Contact District Id', 'manual');
IF COL_LENGTH('dbo.bd_so_order', N'客户区县名称') IS NULL ALTER TABLE dbo.bd_so_order ADD [客户区县名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'客户区县名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'客户区县名称', N'客户区县名称', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'客户区县名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'客户区县名称', 'en', N'Contact District Name', 'manual');
IF COL_LENGTH('dbo.bd_so_order', N'客户区县编码') IS NULL ALTER TABLE dbo.bd_so_order ADD [客户区县编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'客户区县编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'客户区县编码', N'客户区县编码', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'客户区县编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'客户区县编码', 'en', N'Contact District Number', 'manual');
IF COL_LENGTH('dbo.bd_so_order', N'联系信息') IS NULL ALTER TABLE dbo.bd_so_order ADD [联系信息] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'联系信息')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'联系信息', N'联系信息', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'联系信息' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'联系信息', 'en', N'Contact Info', 'manual');
IF COL_LENGTH('dbo.bd_so_order', N'联系地址') IS NULL ALTER TABLE dbo.bd_so_order ADD [联系地址] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'联系地址')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'联系地址', N'联系地址', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'联系地址' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'联系地址', 'en', N'Contact Address', 'manual');
IF COL_LENGTH('dbo.bd_so_order', N'发货国家id') IS NULL ALTER TABLE dbo.bd_so_order ADD [发货国家id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'发货国家id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'发货国家id', N'发货国家id', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'发货国家id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'发货国家id', 'en', N'Dispatcher Country Id', 'manual');
IF COL_LENGTH('dbo.bd_so_order', N'发货国家名称') IS NULL ALTER TABLE dbo.bd_so_order ADD [发货国家名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'发货国家名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'发货国家名称', N'发货国家名称', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'发货国家名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'发货国家名称', 'en', N'Dispatcher Country Name', 'manual');
IF COL_LENGTH('dbo.bd_so_order', N'发货国家编码') IS NULL ALTER TABLE dbo.bd_so_order ADD [发货国家编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'发货国家编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'发货国家编码', N'发货国家编码', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'发货国家编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'发货国家编码', 'en', N'Dispatcher Country Number', 'manual');
IF COL_LENGTH('dbo.bd_so_order', N'发货省份id') IS NULL ALTER TABLE dbo.bd_so_order ADD [发货省份id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'发货省份id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'发货省份id', N'发货省份id', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'发货省份id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'发货省份id', 'en', N'Dispatcher Province Id', 'manual');
IF COL_LENGTH('dbo.bd_so_order', N'发货省份名称') IS NULL ALTER TABLE dbo.bd_so_order ADD [发货省份名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'发货省份名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'发货省份名称', N'发货省份名称', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'发货省份名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'发货省份名称', 'en', N'Dispatcher Province Name', 'manual');
IF COL_LENGTH('dbo.bd_so_order', N'发货省份编码') IS NULL ALTER TABLE dbo.bd_so_order ADD [发货省份编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'发货省份编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'发货省份编码', N'发货省份编码', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'发货省份编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'发货省份编码', 'en', N'Dispatcher Province Number', 'manual');
IF COL_LENGTH('dbo.bd_so_order', N'发货市区id') IS NULL ALTER TABLE dbo.bd_so_order ADD [发货市区id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'发货市区id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'发货市区id', N'发货市区id', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'发货市区id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'发货市区id', 'en', N'Dispatcher City Id', 'manual');
IF COL_LENGTH('dbo.bd_so_order', N'发货市区名称') IS NULL ALTER TABLE dbo.bd_so_order ADD [发货市区名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'发货市区名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'发货市区名称', N'发货市区名称', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'发货市区名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'发货市区名称', 'en', N'Dispatcher City Name', 'manual');
IF COL_LENGTH('dbo.bd_so_order', N'发货市区编码') IS NULL ALTER TABLE dbo.bd_so_order ADD [发货市区编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'发货市区编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'发货市区编码', N'发货市区编码', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'发货市区编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'发货市区编码', 'en', N'Dispatcher City Number', 'manual');
IF COL_LENGTH('dbo.bd_so_order', N'发货区县id') IS NULL ALTER TABLE dbo.bd_so_order ADD [发货区县id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'发货区县id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'发货区县id', N'发货区县id', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'发货区县id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'发货区县id', 'en', N'Dispatcher District Id', 'manual');
IF COL_LENGTH('dbo.bd_so_order', N'发货区县名称') IS NULL ALTER TABLE dbo.bd_so_order ADD [发货区县名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'发货区县名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'发货区县名称', N'发货区县名称', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'发货区县名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'发货区县名称', 'en', N'Dispatcher District Name', 'manual');
IF COL_LENGTH('dbo.bd_so_order', N'发货区县编码') IS NULL ALTER TABLE dbo.bd_so_order ADD [发货区县编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'发货区县编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'发货区县编码', N'发货区县编码', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'发货区县编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'发货区县编码', 'en', N'Dispatcher District Number', 'manual');
IF COL_LENGTH('dbo.bd_so_order', N'发货详细地址') IS NULL ALTER TABLE dbo.bd_so_order ADD [发货详细地址] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'发货详细地址')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'发货详细地址', N'发货详细地址', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'发货详细地址' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'发货详细地址', 'en', N'Dispatcher Address', 'manual');
IF COL_LENGTH('dbo.bd_so_order', N'发货人') IS NULL ALTER TABLE dbo.bd_so_order ADD [发货人] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'发货人')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'发货人', N'发货人', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'发货人' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'发货人', 'en', N'Dispatcher Linkman', 'manual');
IF COL_LENGTH('dbo.bd_so_order', N'发货联系电话') IS NULL ALTER TABLE dbo.bd_so_order ADD [发货联系电话] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'发货联系电话')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'发货联系电话', N'发货联系电话', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'发货联系电话' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'发货联系电话', 'en', N'Dispatcher Phone', 'manual');
IF COL_LENGTH('dbo.bd_so_order', N'发货地址') IS NULL ALTER TABLE dbo.bd_so_order ADD [发货地址] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'发货地址')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'发货地址', N'发货地址', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'发货地址' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'发货地址', 'en', N'Recevice Delivery', 'manual');
IF COL_LENGTH('dbo.bd_so_order', N'付款信息单据体') IS NULL ALTER TABLE dbo.bd_so_order ADD [付款信息单据体] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'付款信息单据体')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'付款信息单据体', N'付款信息单据体', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'付款信息单据体' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'付款信息单据体', 'en', N'Payment Entry', 'manual');
IF COL_LENGTH('dbo.bd_so_order', N'未核销金额') IS NULL ALTER TABLE dbo.bd_so_order ADD [未核销金额] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'未核销金额')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'未核销金额', N'未核销金额', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'未核销金额' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'未核销金额', 'en', N'Total Un Settle Amount', 'manual');
IF COL_LENGTH('dbo.bd_so_order', N'附件个数') IS NULL ALTER TABLE dbo.bd_so_order ADD [附件个数] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'附件个数')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'附件个数', N'附件个数', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'附件个数' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'附件个数', 'en', N'Attachments', 'manual');
IF COL_LENGTH('dbo.bd_so_order', N'附件地址') IS NULL ALTER TABLE dbo.bd_so_order ADD [附件地址] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'附件地址')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'附件地址', N'附件地址', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'附件地址' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'附件地址', 'en', N'Attachments Url', 'manual');
IF COL_LENGTH('dbo.bd_so_order', N'审核人id') IS NULL ALTER TABLE dbo.bd_so_order ADD [审核人id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'审核人id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'审核人id', N'审核人id', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'审核人id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'审核人id', 'en', N'Auditor Id', 'manual');
IF COL_LENGTH('dbo.bd_so_order', N'审核人编码') IS NULL ALTER TABLE dbo.bd_so_order ADD [审核人编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'审核人编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'审核人编码', N'审核人编码', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'审核人编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'审核人编码', 'en', N'Auditor Number', 'manual');
IF COL_LENGTH('dbo.bd_so_order', N'应收款余额') IS NULL ALTER TABLE dbo.bd_so_order ADD [应收款余额] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'应收款余额')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'应收款余额', N'应收款余额', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'应收款余额' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'应收款余额', 'en', N'All Debt', 'manual');
IF COL_LENGTH('dbo.bd_so_order', N'物流公司id') IS NULL ALTER TABLE dbo.bd_so_order ADD [物流公司id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'物流公司id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'物流公司id', N'物流公司id', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'物流公司id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'物流公司id', 'en', N'F Logistics Id', 'manual');
IF COL_LENGTH('dbo.bd_so_order', N'销售费用') IS NULL ALTER TABLE dbo.bd_so_order ADD [销售费用] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'销售费用')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'销售费用', N'销售费用', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'销售费用' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'销售费用', 'en', N'Cost Fee', 'manual');
IF COL_LENGTH('dbo.bd_so_order', N'预收款金额') IS NULL ALTER TABLE dbo.bd_so_order ADD [预收款金额] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'预收款金额')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'预收款金额', N'预收款金额', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'预收款金额' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'预收款金额', 'en', N'Subsist Info', 'manual');
IF COL_LENGTH('dbo.bd_so_order', N'上次欠款') IS NULL ALTER TABLE dbo.bd_so_order ADD [上次欠款] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'上次欠款')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'上次欠款', N'上次欠款', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'上次欠款' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'上次欠款', 'en', N'Last Debt', 'manual');
IF COL_LENGTH('dbo.bd_so_order', N'折扣率') IS NULL ALTER TABLE dbo.bd_so_order ADD [折扣率] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'折扣率')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'折扣率', N'折扣率', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'折扣率' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'折扣率', 'en', N'Bill Dis Rate', 'manual');
IF COL_LENGTH('dbo.bd_so_order', N'修改时间') IS NULL ALTER TABLE dbo.bd_so_order ADD [修改时间] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'修改时间')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'修改时间', N'修改时间', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'修改时间' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'修改时间', 'en', N'Modify Time', 'manual');
IF COL_LENGTH('dbo.bd_so_order', N'创建人id') IS NULL ALTER TABLE dbo.bd_so_order ADD [创建人id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'创建人id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'创建人id', N'创建人id', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'创建人id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'创建人id', 'en', N'Creator Id', 'manual');
IF COL_LENGTH('dbo.bd_so_order', N'创建人名称') IS NULL ALTER TABLE dbo.bd_so_order ADD [创建人名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'创建人名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'创建人名称', N'创建人名称', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'创建人名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'创建人名称', 'en', N'Creator Name', 'manual');
IF COL_LENGTH('dbo.bd_so_order', N'创建人编码') IS NULL ALTER TABLE dbo.bd_so_order ADD [创建人编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'创建人编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'创建人编码', N'创建人编码', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'创建人编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'创建人编码', 'en', N'Creator Number', 'manual');
IF COL_LENGTH('dbo.bd_so_order', N'修改人id') IS NULL ALTER TABLE dbo.bd_so_order ADD [修改人id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'修改人id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'修改人id', N'修改人id', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'修改人id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'修改人id', 'en', N'Modifier Id', 'manual');
IF COL_LENGTH('dbo.bd_so_order', N'修改人名称') IS NULL ALTER TABLE dbo.bd_so_order ADD [修改人名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'修改人名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'修改人名称', N'修改人名称', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'修改人名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'修改人名称', 'en', N'Modifier Name', 'manual');
IF COL_LENGTH('dbo.bd_so_order', N'修改人编码') IS NULL ALTER TABLE dbo.bd_so_order ADD [修改人编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'修改人编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'修改人编码', N'修改人编码', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'修改人编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'修改人编码', 'en', N'Modifier Number', 'manual');
IF COL_LENGTH('dbo.bd_so_order', N'单据标签') IS NULL ALTER TABLE dbo.bd_so_order ADD [单据标签] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'单据标签')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'单据标签', N'单据标签', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'单据标签' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'单据标签', 'en', N'Mulbill Label', 'manual');
IF COL_LENGTH('dbo.bd_so_order', N'业务模式0:普通销售，1:直运销售') IS NULL ALTER TABLE dbo.bd_so_order ADD [业务模式0:普通销售，1:直运销售] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'业务模式0:普通销售，1:直运销售')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'业务模式0:普通销售，1:直运销售', N'业务模式0:普通销售，1:直运销售', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'业务模式0:普通销售，1:直运销售' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'业务模式0:普通销售，1:直运销售', 'en', N'Biz Mode', 'manual');
IF COL_LENGTH('dbo.bd_so_order', N'结算日期') IS NULL ALTER TABLE dbo.bd_so_order ADD [结算日期] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'结算日期')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'结算日期', N'结算日期', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'结算日期' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'结算日期', 'en', N'Due Date', 'manual');
IF COL_LENGTH('dbo.bd_so_order', N'结算期限id') IS NULL ALTER TABLE dbo.bd_so_order ADD [结算期限id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'结算期限id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'结算期限id', N'结算期限id', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'结算期限id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'结算期限id', 'en', N'Setting Term Id', 'manual');
IF COL_LENGTH('dbo.bd_so_order', N'结算期限编码') IS NULL ALTER TABLE dbo.bd_so_order ADD [结算期限编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'结算期限编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'结算期限编码', N'结算期限编码', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'结算期限编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'结算期限编码', 'en', N'Setting Term Number', 'manual');
IF COL_LENGTH('dbo.bd_so_order', N'交货方式id,6-物流发货，8-车辆配送，9-客户自提') IS NULL ALTER TABLE dbo.bd_so_order ADD [交货方式id,6-物流发货，8-车辆配送，9-客户自提] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'交货方式id,6-物流发货，8-车辆配送，9-客户自提')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'交货方式id,6-物流发货，8-车辆配送，9-客户自提', N'交货方式id,6-物流发货，8-车辆配送，9-客户自提', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'交货方式id,6-物流发货，8-车辆配送，9-客户自提' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'交货方式id,6-物流发货，8-车辆配送，9-客户自提', 'en', N'Delivery Type Id', 'manual');
IF COL_LENGTH('dbo.bd_so_order', N'本次定金') IS NULL ALTER TABLE dbo.bd_so_order ADD [本次定金] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'本次定金')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'本次定金', N'本次定金', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'本次定金' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'本次定金', 'en', N'Total Deposit', 'manual');
IF COL_LENGTH('dbo.bd_so_order', N'累计预收') IS NULL ALTER TABLE dbo.bd_so_order ADD [累计预收] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'累计预收')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'累计预收', N'累计预收', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'累计预收' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'累计预收', 'en', N'Total Pre Settle Amount', 'manual');
IF COL_LENGTH('dbo.bd_so_order', N'发票类型：1：普票，2:专票') IS NULL ALTER TABLE dbo.bd_so_order ADD [发票类型：1：普票，2:专票] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'发票类型：1：普票，2:专票')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'发票类型：1：普票，2:专票', N'发票类型：1：普票，2:专票', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'发票类型：1：普票，2:专票' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'发票类型：1：普票，2:专票', 'en', N'Ivc Type', 'manual');
IF COL_LENGTH('dbo.bd_so_order', N'客户承担费用单据体') IS NULL ALTER TABLE dbo.bd_so_order ADD [客户承担费用单据体] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'客户承担费用单据体')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'客户承担费用单据体', N'客户承担费用单据体', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'客户承担费用单据体' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'客户承担费用单据体', 'en', N'Cus Bear Fee Entry', 'manual');
IF COL_LENGTH('dbo.bd_so_order', N'费用信息单据体') IS NULL ALTER TABLE dbo.bd_so_order ADD [费用信息单据体] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'费用信息单据体')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'费用信息单据体', N'费用信息单据体', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'费用信息单据体' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'费用信息单据体', 'en', N'Cost Fee Entity', 'manual');
IF COL_LENGTH('dbo.bd_so_order', N'结算客户id') IS NULL ALTER TABLE dbo.bd_so_order ADD [结算客户id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'结算客户id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'结算客户id', N'结算客户id', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'结算客户id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'结算客户id', 'en', N'Settle Customer Id', 'manual');
IF COL_LENGTH('dbo.bd_so_order', N'开票状态') IS NULL ALTER TABLE dbo.bd_so_order ADD [开票状态] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'开票状态')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'开票状态', N'开票状态', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'开票状态' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'开票状态', 'en', N'Ivc Status', 'manual');
IF COL_LENGTH('dbo.bd_so_order', N'已执行金额') IS NULL ALTER TABLE dbo.bd_so_order ADD [已执行金额] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'已执行金额')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'已执行金额', N'已执行金额', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'已执行金额' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'已执行金额', 'en', N'Io Amount', 'manual');
IF COL_LENGTH('dbo.bd_so_order', N'未执行金额') IS NULL ALTER TABLE dbo.bd_so_order ADD [未执行金额] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'未执行金额')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'未执行金额', N'未执行金额', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'未执行金额' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'未执行金额', 'en', N'Un Io Amount', 'manual');
IF COL_LENGTH('dbo.bd_so_order', N'累计预收状态') IS NULL ALTER TABLE dbo.bd_so_order ADD [累计预收状态] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'累计预收状态')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'累计预收状态', N'累计预收状态', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'累计预收状态' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'累计预收状态', 'en', N'Total Pre Settle Status', 'manual');
GO

-- ══ PU_ORDER(PU_ORDER→bd_pu_order):并集 79 键,补 65 ══
IF COL_LENGTH('dbo.bd_pu_order', N'创建时间') IS NULL ALTER TABLE dbo.bd_pu_order ADD [创建时间] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'创建时间')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'创建时间', N'创建时间', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'创建时间' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'创建时间', 'en', N'Create Time', 'manual');
IF COL_LENGTH('dbo.bd_pu_order', N'关闭状态') IS NULL ALTER TABLE dbo.bd_pu_order ADD [关闭状态] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'关闭状态')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'关闭状态', N'关闭状态', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'关闭状态' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'关闭状态', 'en', N'Bill Close State', 'manual');
IF COL_LENGTH('dbo.bd_pu_order', N'供应商id') IS NULL ALTER TABLE dbo.bd_pu_order ADD [供应商id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'供应商id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'供应商id', N'供应商id', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'供应商id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'供应商id', 'en', N'Supplier Id', 'manual');
IF COL_LENGTH('dbo.bd_pu_order', N'业务员id') IS NULL ALTER TABLE dbo.bd_pu_order ADD [业务员id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'业务员id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'业务员id', N'业务员id', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'业务员id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'业务员id', 'en', N'Emp Id', 'manual');
IF COL_LENGTH('dbo.bd_pu_order', N'业务员名称') IS NULL ALTER TABLE dbo.bd_pu_order ADD [业务员名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'业务员名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'业务员名称', N'业务员名称', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'业务员名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'业务员名称', 'en', N'Emp Name', 'manual');
IF COL_LENGTH('dbo.bd_pu_order', N'业务员编码') IS NULL ALTER TABLE dbo.bd_pu_order ADD [业务员编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'业务员编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'业务员编码', N'业务员编码', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'业务员编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'业务员编码', 'en', N'Emp Number', 'manual');
IF COL_LENGTH('dbo.bd_pu_order', N'入库状态Z部分入库，C全部入库，A未入库') IS NULL ALTER TABLE dbo.bd_pu_order ADD [入库状态Z部分入库，C全部入库，A未入库] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'入库状态Z部分入库，C全部入库，A未入库')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'入库状态Z部分入库，C全部入库，A未入库', N'入库状态Z部分入库，C全部入库，A未入库', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'入库状态Z部分入库，C全部入库，A未入库' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'入库状态Z部分入库，C全部入库，A未入库', 'en', N'Io Status', 'manual');
IF COL_LENGTH('dbo.bd_pu_order', N'实际出入库状态') IS NULL ALTER TABLE dbo.bd_pu_order ADD [实际出入库状态] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'实际出入库状态')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'实际出入库状态', N'实际出入库状态', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'实际出入库状态' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'实际出入库状态', 'en', N'Real Io Status', 'manual');
IF COL_LENGTH('dbo.bd_pu_order', N'delivery_type_id') IS NULL ALTER TABLE dbo.bd_pu_order ADD [delivery_type_id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'delivery_type_id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'delivery_type_id', N'delivery_type_id', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'delivery_type_id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'delivery_type_id', 'en', N'Delivery Type Id', 'manual');
IF COL_LENGTH('dbo.bd_pu_order', N'交货方式') IS NULL ALTER TABLE dbo.bd_pu_order ADD [交货方式] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'交货方式')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'交货方式', N'交货方式', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'交货方式' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'交货方式', 'en', N'Delivery Type Name', 'manual');
IF COL_LENGTH('dbo.bd_pu_order', N'delivery_type_number') IS NULL ALTER TABLE dbo.bd_pu_order ADD [delivery_type_number] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'delivery_type_number')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'delivery_type_number', N'delivery_type_number', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'delivery_type_number' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'delivery_type_number', 'en', N'Delivery Type Number', 'manual');
IF COL_LENGTH('dbo.bd_pu_order', N'修改时间') IS NULL ALTER TABLE dbo.bd_pu_order ADD [修改时间] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'修改时间')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'修改时间', N'修改时间', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'修改时间' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'修改时间', 'en', N'Modify Time', 'manual');
IF COL_LENGTH('dbo.bd_pu_order', N'创建人id') IS NULL ALTER TABLE dbo.bd_pu_order ADD [创建人id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'创建人id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'创建人id', N'创建人id', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'创建人id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'创建人id', 'en', N'Creator Id', 'manual');
IF COL_LENGTH('dbo.bd_pu_order', N'创建人名称') IS NULL ALTER TABLE dbo.bd_pu_order ADD [创建人名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'创建人名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'创建人名称', N'创建人名称', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'创建人名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'创建人名称', 'en', N'Creator Name', 'manual');
IF COL_LENGTH('dbo.bd_pu_order', N'创建人编码') IS NULL ALTER TABLE dbo.bd_pu_order ADD [创建人编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'创建人编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'创建人编码', N'创建人编码', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'创建人编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'创建人编码', 'en', N'Creator Number', 'manual');
IF COL_LENGTH('dbo.bd_pu_order', N'修改人id') IS NULL ALTER TABLE dbo.bd_pu_order ADD [修改人id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'修改人id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'修改人id', N'修改人id', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'修改人id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'修改人id', 'en', N'Modifier Id', 'manual');
IF COL_LENGTH('dbo.bd_pu_order', N'修改人名称') IS NULL ALTER TABLE dbo.bd_pu_order ADD [修改人名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'修改人名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'修改人名称', N'修改人名称', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'修改人名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'修改人名称', 'en', N'Modifier Name', 'manual');
IF COL_LENGTH('dbo.bd_pu_order', N'修改人编码') IS NULL ALTER TABLE dbo.bd_pu_order ADD [修改人编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'修改人编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'修改人编码', N'修改人编码', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'修改人编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'修改人编码', 'en', N'Modifier Number', 'manual');
IF COL_LENGTH('dbo.bd_pu_order', N'审核人id') IS NULL ALTER TABLE dbo.bd_pu_order ADD [审核人id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'审核人id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'审核人id', N'审核人id', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'审核人id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'审核人id', 'en', N'Auditor Id', 'manual');
IF COL_LENGTH('dbo.bd_pu_order', N'审核人编码') IS NULL ALTER TABLE dbo.bd_pu_order ADD [审核人编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'审核人编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'审核人编码', N'审核人编码', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'审核人编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'审核人编码', 'en', N'Auditor Number', 'manual');
IF COL_LENGTH('dbo.bd_pu_order', N'业务类型') IS NULL ALTER TABLE dbo.bd_pu_order ADD [业务类型] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'业务类型')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'业务类型', N'业务类型', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'业务类型' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'业务类型', 'en', N'Trans Type', 'manual');
IF COL_LENGTH('dbo.bd_pu_order', N'部门id') IS NULL ALTER TABLE dbo.bd_pu_order ADD [部门id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'部门id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'部门id', N'部门id', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'部门id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'部门id', 'en', N'Dept Id', 'manual');
IF COL_LENGTH('dbo.bd_pu_order', N'部门名称') IS NULL ALTER TABLE dbo.bd_pu_order ADD [部门名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'部门名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'部门名称', N'部门名称', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'部门名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'部门名称', 'en', N'Dept Name', 'manual');
IF COL_LENGTH('dbo.bd_pu_order', N'部门编码') IS NULL ALTER TABLE dbo.bd_pu_order ADD [部门编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'部门编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'部门编码', N'部门编码', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'部门编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'部门编码', 'en', N'Dept Number', 'manual');
IF COL_LENGTH('dbo.bd_pu_order', N'客户id') IS NULL ALTER TABLE dbo.bd_pu_order ADD [客户id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'客户id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'客户id', N'客户id', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'客户id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'客户id', 'en', N'Customer Id', 'manual');
IF COL_LENGTH('dbo.bd_pu_order', N'客户名称') IS NULL ALTER TABLE dbo.bd_pu_order ADD [客户名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'客户名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'客户名称', N'客户名称', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'客户名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'客户名称', 'en', N'Customer Name', 'manual');
IF COL_LENGTH('dbo.bd_pu_order', N'客户编码') IS NULL ALTER TABLE dbo.bd_pu_order ADD [客户编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'客户编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'客户编码', N'客户编码', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'客户编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'客户编码', 'en', N'Customer Number', 'manual');
IF COL_LENGTH('dbo.bd_pu_order', N'联系信息-联系方式') IS NULL ALTER TABLE dbo.bd_pu_order ADD [联系信息-联系方式] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'联系信息-联系方式')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'联系信息-联系方式', N'联系信息-联系方式', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'联系信息-联系方式' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'联系信息-联系方式', 'en', N'Contact Phone', 'manual');
IF COL_LENGTH('dbo.bd_pu_order', N'供应商发货地址国家id') IS NULL ALTER TABLE dbo.bd_pu_order ADD [供应商发货地址国家id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'供应商发货地址国家id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'供应商发货地址国家id', N'供应商发货地址国家id', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'供应商发货地址国家id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'供应商发货地址国家id', 'en', N'Contact Country Id', 'manual');
IF COL_LENGTH('dbo.bd_pu_order', N'供应商发货地址国家名称') IS NULL ALTER TABLE dbo.bd_pu_order ADD [供应商发货地址国家名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'供应商发货地址国家名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'供应商发货地址国家名称', N'供应商发货地址国家名称', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'供应商发货地址国家名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'供应商发货地址国家名称', 'en', N'Contact Country Name', 'manual');
IF COL_LENGTH('dbo.bd_pu_order', N'供应商发货地址国家编码') IS NULL ALTER TABLE dbo.bd_pu_order ADD [供应商发货地址国家编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'供应商发货地址国家编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'供应商发货地址国家编码', N'供应商发货地址国家编码', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'供应商发货地址国家编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'供应商发货地址国家编码', 'en', N'Contact Country Number', 'manual');
IF COL_LENGTH('dbo.bd_pu_order', N'供应商发货地址省份id') IS NULL ALTER TABLE dbo.bd_pu_order ADD [供应商发货地址省份id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'供应商发货地址省份id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'供应商发货地址省份id', N'供应商发货地址省份id', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'供应商发货地址省份id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'供应商发货地址省份id', 'en', N'Contact Province Id', 'manual');
IF COL_LENGTH('dbo.bd_pu_order', N'供应商发货地址省份名称') IS NULL ALTER TABLE dbo.bd_pu_order ADD [供应商发货地址省份名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'供应商发货地址省份名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'供应商发货地址省份名称', N'供应商发货地址省份名称', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'供应商发货地址省份名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'供应商发货地址省份名称', 'en', N'Contact Province Name', 'manual');
IF COL_LENGTH('dbo.bd_pu_order', N'供应商发货地址省份编码') IS NULL ALTER TABLE dbo.bd_pu_order ADD [供应商发货地址省份编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'供应商发货地址省份编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'供应商发货地址省份编码', N'供应商发货地址省份编码', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'供应商发货地址省份编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'供应商发货地址省份编码', 'en', N'Contact Province Number', 'manual');
IF COL_LENGTH('dbo.bd_pu_order', N'供应商发货地址市区id') IS NULL ALTER TABLE dbo.bd_pu_order ADD [供应商发货地址市区id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'供应商发货地址市区id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'供应商发货地址市区id', N'供应商发货地址市区id', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'供应商发货地址市区id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'供应商发货地址市区id', 'en', N'Contact City Id', 'manual');
IF COL_LENGTH('dbo.bd_pu_order', N'供应商发货地址市区名称') IS NULL ALTER TABLE dbo.bd_pu_order ADD [供应商发货地址市区名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'供应商发货地址市区名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'供应商发货地址市区名称', N'供应商发货地址市区名称', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'供应商发货地址市区名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'供应商发货地址市区名称', 'en', N'Contact City Name', 'manual');
IF COL_LENGTH('dbo.bd_pu_order', N'供应商发货地址市区编码') IS NULL ALTER TABLE dbo.bd_pu_order ADD [供应商发货地址市区编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'供应商发货地址市区编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'供应商发货地址市区编码', N'供应商发货地址市区编码', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'供应商发货地址市区编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'供应商发货地址市区编码', 'en', N'Contact City Number', 'manual');
IF COL_LENGTH('dbo.bd_pu_order', N'供应商发货地址区县id') IS NULL ALTER TABLE dbo.bd_pu_order ADD [供应商发货地址区县id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'供应商发货地址区县id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'供应商发货地址区县id', N'供应商发货地址区县id', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'供应商发货地址区县id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'供应商发货地址区县id', 'en', N'Contact District Id', 'manual');
IF COL_LENGTH('dbo.bd_pu_order', N'供应商发货地址区县名称') IS NULL ALTER TABLE dbo.bd_pu_order ADD [供应商发货地址区县名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'供应商发货地址区县名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'供应商发货地址区县名称', N'供应商发货地址区县名称', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'供应商发货地址区县名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'供应商发货地址区县名称', 'en', N'Contact District Name', 'manual');
IF COL_LENGTH('dbo.bd_pu_order', N'供应商发货地址区县编码') IS NULL ALTER TABLE dbo.bd_pu_order ADD [供应商发货地址区县编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'供应商发货地址区县编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'供应商发货地址区县编码', N'供应商发货地址区县编码', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'供应商发货地址区县编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'供应商发货地址区县编码', 'en', N'Contact District Number', 'manual');
IF COL_LENGTH('dbo.bd_pu_order', N'联系地址') IS NULL ALTER TABLE dbo.bd_pu_order ADD [联系地址] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'联系地址')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'联系地址', N'联系地址', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'联系地址' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'联系地址', 'en', N'Contact Address', 'manual');
IF COL_LENGTH('dbo.bd_pu_order', N'发送状态') IS NULL ALTER TABLE dbo.bd_pu_order ADD [发送状态] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'发送状态')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'发送状态', N'发送状态', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'发送状态' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'发送状态', 'en', N'Send Status', 'manual');
IF COL_LENGTH('dbo.bd_pu_order', N'附件个数') IS NULL ALTER TABLE dbo.bd_pu_order ADD [附件个数] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'附件个数')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'附件个数', N'附件个数', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'附件个数' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'附件个数', 'en', N'Attachments', 'manual');
IF COL_LENGTH('dbo.bd_pu_order', N'附件地址') IS NULL ALTER TABLE dbo.bd_pu_order ADD [附件地址] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'附件地址')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'附件地址', N'附件地址', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'附件地址' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'附件地址', 'en', N'Attachments Url', 'manual');
IF COL_LENGTH('dbo.bd_pu_order', N'结算日期') IS NULL ALTER TABLE dbo.bd_pu_order ADD [结算日期] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'结算日期')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'结算日期', N'结算日期', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'结算日期' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'结算日期', 'en', N'Due Date', 'manual');
IF COL_LENGTH('dbo.bd_pu_order', N'结算期限id') IS NULL ALTER TABLE dbo.bd_pu_order ADD [结算期限id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'结算期限id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'结算期限id', N'结算期限id', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'结算期限id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'结算期限id', 'en', N'Setting Term Id', 'manual');
IF COL_LENGTH('dbo.bd_pu_order', N'结算期限编码') IS NULL ALTER TABLE dbo.bd_pu_order ADD [结算期限编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'结算期限编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'结算期限编码', N'结算期限编码', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'结算期限编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'结算期限编码', 'en', N'Setting Term Number', 'manual');
IF COL_LENGTH('dbo.bd_pu_order', N'收货地址人') IS NULL ALTER TABLE dbo.bd_pu_order ADD [收货地址人] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'收货地址人')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'收货地址人', N'收货地址人', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'收货地址人' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'收货地址人', 'en', N'Dispatcher Linkman', 'manual');
IF COL_LENGTH('dbo.bd_pu_order', N'收货地址联系电话') IS NULL ALTER TABLE dbo.bd_pu_order ADD [收货地址联系电话] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'收货地址联系电话')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'收货地址联系电话', N'收货地址联系电话', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'收货地址联系电话' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'收货地址联系电话', 'en', N'Dispatcher Phone', 'manual');
IF COL_LENGTH('dbo.bd_pu_order', N'收货地址-详细地址') IS NULL ALTER TABLE dbo.bd_pu_order ADD [收货地址-详细地址] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'收货地址-详细地址')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'收货地址-详细地址', N'收货地址-详细地址', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'收货地址-详细地址' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'收货地址-详细地址', 'en', N'Dispatcher Address', 'manual');
IF COL_LENGTH('dbo.bd_pu_order', N'收货地址国家id') IS NULL ALTER TABLE dbo.bd_pu_order ADD [收货地址国家id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'收货地址国家id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'收货地址国家id', N'收货地址国家id', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'收货地址国家id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'收货地址国家id', 'en', N'Dispatcher Country Id', 'manual');
IF COL_LENGTH('dbo.bd_pu_order', N'收货地址国家名称') IS NULL ALTER TABLE dbo.bd_pu_order ADD [收货地址国家名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'收货地址国家名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'收货地址国家名称', N'收货地址国家名称', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'收货地址国家名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'收货地址国家名称', 'en', N'Dispatcher Country Name', 'manual');
IF COL_LENGTH('dbo.bd_pu_order', N'收货地址国家编码') IS NULL ALTER TABLE dbo.bd_pu_order ADD [收货地址国家编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'收货地址国家编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'收货地址国家编码', N'收货地址国家编码', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'收货地址国家编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'收货地址国家编码', 'en', N'Dispatcher Country Number', 'manual');
IF COL_LENGTH('dbo.bd_pu_order', N'收货地址-省ID') IS NULL ALTER TABLE dbo.bd_pu_order ADD [收货地址-省ID] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'收货地址-省ID')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'收货地址-省ID', N'收货地址-省ID', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'收货地址-省ID' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'收货地址-省ID', 'en', N'Dispatcher Province Id', 'manual');
IF COL_LENGTH('dbo.bd_pu_order', N'收货地址省份名称') IS NULL ALTER TABLE dbo.bd_pu_order ADD [收货地址省份名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'收货地址省份名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'收货地址省份名称', N'收货地址省份名称', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'收货地址省份名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'收货地址省份名称', 'en', N'Dispatcher Province Name', 'manual');
IF COL_LENGTH('dbo.bd_pu_order', N'收货地址省份编码') IS NULL ALTER TABLE dbo.bd_pu_order ADD [收货地址省份编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'收货地址省份编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'收货地址省份编码', N'收货地址省份编码', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'收货地址省份编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'收货地址省份编码', 'en', N'Dispatcher Province Number', 'manual');
IF COL_LENGTH('dbo.bd_pu_order', N'收货地址-市ID') IS NULL ALTER TABLE dbo.bd_pu_order ADD [收货地址-市ID] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'收货地址-市ID')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'收货地址-市ID', N'收货地址-市ID', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'收货地址-市ID' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'收货地址-市ID', 'en', N'Dispatcher City Id', 'manual');
IF COL_LENGTH('dbo.bd_pu_order', N'收货地址市区名称') IS NULL ALTER TABLE dbo.bd_pu_order ADD [收货地址市区名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'收货地址市区名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'收货地址市区名称', N'收货地址市区名称', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'收货地址市区名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'收货地址市区名称', 'en', N'Dispatcher City Name', 'manual');
IF COL_LENGTH('dbo.bd_pu_order', N'收货地址区编码') IS NULL ALTER TABLE dbo.bd_pu_order ADD [收货地址区编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'收货地址区编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'收货地址区编码', N'收货地址区编码', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'收货地址区编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'收货地址区编码', 'en', N'Dispatcher City Number', 'manual');
IF COL_LENGTH('dbo.bd_pu_order', N'收货地址-区ID') IS NULL ALTER TABLE dbo.bd_pu_order ADD [收货地址-区ID] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'收货地址-区ID')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'收货地址-区ID', N'收货地址-区ID', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'收货地址-区ID' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'收货地址-区ID', 'en', N'Dispatcher District Id', 'manual');
IF COL_LENGTH('dbo.bd_pu_order', N'收货地址区县名称') IS NULL ALTER TABLE dbo.bd_pu_order ADD [收货地址区县名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'收货地址区县名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'收货地址区县名称', N'收货地址区县名称', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'收货地址区县名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'收货地址区县名称', 'en', N'Dispatcher District Name', 'manual');
IF COL_LENGTH('dbo.bd_pu_order', N'收货地址区县编码') IS NULL ALTER TABLE dbo.bd_pu_order ADD [收货地址区县编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'收货地址区县编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'收货地址区县编码', N'收货地址区县编码', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'收货地址区县编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'收货地址区县编码', 'en', N'Dispatcher District Number', 'manual');
IF COL_LENGTH('dbo.bd_pu_order', N'采购费用明细') IS NULL ALTER TABLE dbo.bd_pu_order ADD [采购费用明细] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'采购费用明细')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'采购费用明细', N'采购费用明细', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'采购费用明细' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'采购费用明细', 'en', N'Cost Fee Entity', 'manual');
IF COL_LENGTH('dbo.bd_pu_order', N'累计预付') IS NULL ALTER TABLE dbo.bd_pu_order ADD [累计预付] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'累计预付')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'累计预付', N'累计预付', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'累计预付' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'累计预付', 'en', N'Total Pre Settle Amount', 'manual');
IF COL_LENGTH('dbo.bd_pu_order', N'累计预付本位币') IS NULL ALTER TABLE dbo.bd_pu_order ADD [累计预付本位币] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'累计预付本位币')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'累计预付本位币', N'累计预付本位币', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'累计预付本位币' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'累计预付本位币', 'en', N'Total Pre Settle Amount For', 'manual');
GO

PRINT N'migrate-kingdee-full-union 完成';
GO