-- migrate-kingdee-subentity-union.sql — 子实体(订单行+联系人)字段与文档并集完全对应
-- 生成器:tools/archive/_gen-subentity-union.mjs;行级补 bl_so_order/bl_pu_order,联系人级补 dm_kh/dm_gf(dotted 路径 bomentity.xx)
IF DB_NAME() = N'master' USE HSDZ_MES;   -- 仅在未选定库时切正式库(选定测试库/克隆库时不得被切走)
SET NOCOUNT ON;
GO

-- ══ SO_ORDER 行子实体:补 89 列 ══
IF COL_LENGTH('dbo.bl_so_order', N'图片url') IS NULL ALTER TABLE dbo.bl_so_order ADD [图片url] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'图片url')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'图片url', N'图片url', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'图片url' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'图片url', 'en', N'Picture', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'商品id') IS NULL ALTER TABLE dbo.bl_so_order ADD [商品id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'商品id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'商品id', N'商品id', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'商品id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'商品id', 'en', N'Material Id', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'商品是否多单位') IS NULL ALTER TABLE dbo.bl_so_order ADD [商品是否多单位] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'商品是否多单位')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'商品是否多单位', N'商品是否多单位', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'商品是否多单位' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'商品是否多单位', 'en', N'Material Is Multi Unit', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'商品是否序列号') IS NULL ALTER TABLE dbo.bl_so_order ADD [商品是否序列号] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'商品是否序列号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'商品是否序列号', N'商品是否序列号', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'商品是否序列号' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'商品是否序列号', 'en', N'Material Is Serial', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'商品是否启用辅助属性') IS NULL ALTER TABLE dbo.bl_so_order ADD [商品是否启用辅助属性] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'商品是否启用辅助属性')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'商品是否启用辅助属性', N'商品是否启用辅助属性', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'商品是否启用辅助属性' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'商品是否启用辅助属性', 'en', N'Material Is Asst Attr', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'商品是否开启保质期') IS NULL ALTER TABLE dbo.bl_so_order ADD [商品是否开启保质期] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'商品是否开启保质期')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'商品是否开启保质期', N'商品是否开启保质期', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'商品是否开启保质期' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'商品是否开启保质期', 'en', N'Material Is Kf Period', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'商品是否开启批次') IS NULL ALTER TABLE dbo.bl_so_order ADD [商品是否开启批次] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'商品是否开启批次')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'商品是否开启批次', N'商品是否开启批次', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'商品是否开启批次' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'商品是否开启批次', 'en', N'Material Is Batch', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'商品助记码') IS NULL ALTER TABLE dbo.bl_so_order ADD [商品助记码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'商品助记码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'商品助记码', N'商品助记码', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'商品助记码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'商品助记码', 'en', N'Material Help Code', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'仓库id') IS NULL ALTER TABLE dbo.bl_so_order ADD [仓库id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'仓库id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'仓库id', N'仓库id', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'仓库id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'仓库id', 'en', N'Stock Id', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'仓库名称') IS NULL ALTER TABLE dbo.bl_so_order ADD [仓库名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'仓库名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'仓库名称', N'仓库名称', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'仓库名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'仓库名称', 'en', N'Stock Name', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'仓库编码') IS NULL ALTER TABLE dbo.bl_so_order ADD [仓库编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'仓库编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'仓库编码', N'仓库编码', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'仓库编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'仓库编码', 'en', N'Stock Number', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'仓库启用仓位管理') IS NULL ALTER TABLE dbo.bl_so_order ADD [仓库启用仓位管理] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'仓库启用仓位管理')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'仓库启用仓位管理', N'仓库启用仓位管理', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'仓库启用仓位管理' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'仓库启用仓位管理', 'en', N'Stock Is Allow Freight', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'仓位id') IS NULL ALTER TABLE dbo.bl_so_order ADD [仓位id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'仓位id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'仓位id', N'仓位id', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'仓位id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'仓位id', 'en', N'Sp Id', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'仓位名称') IS NULL ALTER TABLE dbo.bl_so_order ADD [仓位名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'仓位名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'仓位名称', N'仓位名称', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'仓位名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'仓位名称', 'en', N'Sp Name', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'仓位编码') IS NULL ALTER TABLE dbo.bl_so_order ADD [仓位编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'仓位编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'仓位编码', N'仓位编码', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'仓位编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'仓位编码', 'en', N'Sp Number', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'辅助属性id') IS NULL ALTER TABLE dbo.bl_so_order ADD [辅助属性id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'辅助属性id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'辅助属性id', N'辅助属性id', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助属性id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助属性id', 'en', N'Aux Prop Id', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'辅助属性名称') IS NULL ALTER TABLE dbo.bl_so_order ADD [辅助属性名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'辅助属性名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'辅助属性名称', N'辅助属性名称', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助属性名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助属性名称', 'en', N'Aux Prop Name', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'辅助属性编码') IS NULL ALTER TABLE dbo.bl_so_order ADD [辅助属性编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'辅助属性编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'辅助属性编码', N'辅助属性编码', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助属性编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助属性编码', 'en', N'Aux Prop Number', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'辅助属性1id') IS NULL ALTER TABLE dbo.bl_so_order ADD [辅助属性1id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'辅助属性1id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'辅助属性1id', N'辅助属性1id', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助属性1id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助属性1id', 'en', N'Aux Id1', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'辅助属性1名称') IS NULL ALTER TABLE dbo.bl_so_order ADD [辅助属性1名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'辅助属性1名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'辅助属性1名称', N'辅助属性1名称', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助属性1名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助属性1名称', 'en', N'Aux Name1', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'辅助属性1编码') IS NULL ALTER TABLE dbo.bl_so_order ADD [辅助属性1编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'辅助属性1编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'辅助属性1编码', N'辅助属性1编码', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助属性1编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助属性1编码', 'en', N'Aux Number1', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'辅助属性2id') IS NULL ALTER TABLE dbo.bl_so_order ADD [辅助属性2id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'辅助属性2id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'辅助属性2id', N'辅助属性2id', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助属性2id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助属性2id', 'en', N'Aux Id2', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'辅助属性2名称') IS NULL ALTER TABLE dbo.bl_so_order ADD [辅助属性2名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'辅助属性2名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'辅助属性2名称', N'辅助属性2名称', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助属性2名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助属性2名称', 'en', N'Aux Name2', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'辅助属性2编码') IS NULL ALTER TABLE dbo.bl_so_order ADD [辅助属性2编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'辅助属性2编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'辅助属性2编码', N'辅助属性2编码', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助属性2编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助属性2编码', 'en', N'Aux Number2', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'辅助属性3id') IS NULL ALTER TABLE dbo.bl_so_order ADD [辅助属性3id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'辅助属性3id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'辅助属性3id', N'辅助属性3id', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助属性3id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助属性3id', 'en', N'Aux Id3', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'辅助属性3名称') IS NULL ALTER TABLE dbo.bl_so_order ADD [辅助属性3名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'辅助属性3名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'辅助属性3名称', N'辅助属性3名称', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助属性3名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助属性3名称', 'en', N'Aux Name3', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'辅助属性3编码') IS NULL ALTER TABLE dbo.bl_so_order ADD [辅助属性3编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'辅助属性3编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'辅助属性3编码', N'辅助属性3编码', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助属性3编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助属性3编码', 'en', N'Aux Number3', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'条形码') IS NULL ALTER TABLE dbo.bl_so_order ADD [条形码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'条形码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'条形码', N'条形码', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'条形码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'条形码', 'en', N'Barcode', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'实际含税单价') IS NULL ALTER TABLE dbo.bl_so_order ADD [实际含税单价] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'实际含税单价')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'实际含税单价', N'实际含税单价', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'实际含税单价' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'实际含税单价', 'en', N'Act Tax Price', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'基本单位id') IS NULL ALTER TABLE dbo.bl_so_order ADD [基本单位id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'基本单位id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'基本单位id', N'基本单位id', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'基本单位id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'基本单位id', 'en', N'Base Unit Id', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'基本单位名称') IS NULL ALTER TABLE dbo.bl_so_order ADD [基本单位名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'基本单位名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'基本单位名称', N'基本单位名称', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'基本单位名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'基本单位名称', 'en', N'Base Unit Name', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'基本单位编码') IS NULL ALTER TABLE dbo.bl_so_order ADD [基本单位编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'基本单位编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'基本单位编码', N'基本单位编码', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'基本单位编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'基本单位编码', 'en', N'Base Unit Number', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'单位id') IS NULL ALTER TABLE dbo.bl_so_order ADD [单位id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'单位id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'单位id', N'单位id', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'单位id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'单位id', 'en', N'Unit Id', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'单位编码') IS NULL ALTER TABLE dbo.bl_so_order ADD [单位编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'单位编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'单位编码', N'单位编码', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'单位编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'单位编码', 'en', N'Unit Number', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'换算率') IS NULL ALTER TABLE dbo.bl_so_order ADD [换算率] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'换算率')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'换算率', N'换算率', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'换算率' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'换算率', 'en', N'Coefficient', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'换算公式') IS NULL ALTER TABLE dbo.bl_so_order ADD [换算公式] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'换算公式')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'换算公式', N'换算公式', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'换算公式' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'换算公式', 'en', N'Conversion Rate', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'基本库存数量') IS NULL ALTER TABLE dbo.bl_so_order ADD [基本库存数量] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'基本库存数量')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'基本库存数量', N'基本库存数量', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'基本库存数量' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'基本库存数量', 'en', N'Inv Base Qty', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'退货数量') IS NULL ALTER TABLE dbo.bl_so_order ADD [退货数量] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'退货数量')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'退货数量', N'退货数量', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'退货数量' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'退货数量', 'en', N'Return Qty Unit', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'退货基本数量') IS NULL ALTER TABLE dbo.bl_so_order ADD [退货基本数量] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'退货基本数量')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'退货基本数量', N'退货基本数量', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'退货基本数量' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'退货基本数量', 'en', N'Return Qty', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'税额') IS NULL ALTER TABLE dbo.bl_so_order ADD [税额] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'税额')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'税额', N'税额', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'税额' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'税额', 'en', N'Tax Amount', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'整单折扣分配额') IS NULL ALTER TABLE dbo.bl_so_order ADD [整单折扣分配额] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'整单折扣分配额')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'整单折扣分配额', N'整单折扣分配额', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'整单折扣分配额' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'整单折扣分配额', 'en', N'Bill Dis Distribution', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'折扣') IS NULL ALTER TABLE dbo.bl_so_order ADD [折扣] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'折扣')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'折扣', N'折扣', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'折扣' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'折扣', 'en', N'Discount', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'销售费用分摊') IS NULL ALTER TABLE dbo.bl_so_order ADD [销售费用分摊] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'销售费用分摊')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'销售费用分摊', N'销售费用分摊', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'销售费用分摊' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'销售费用分摊', 'en', N'Fee', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'优惠分摊金额') IS NULL ALTER TABLE dbo.bl_so_order ADD [优惠分摊金额] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'优惠分摊金额')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'优惠分摊金额', N'优惠分摊金额', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'优惠分摊金额' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'优惠分摊金额', 'en', N'Divide Diff Amount', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'折算率') IS NULL ALTER TABLE dbo.bl_so_order ADD [折算率] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'折算率')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'折算率', N'折算率', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'折算率' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'折算率', 'en', N'Dis Rate', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'折前金额') IS NULL ALTER TABLE dbo.bl_so_order ADD [折前金额] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'折前金额')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'折前金额', N'折前金额', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'折前金额' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'折前金额', 'en', N'Pre Dis Amount', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'实际不含税金额') IS NULL ALTER TABLE dbo.bl_so_order ADD [实际不含税金额] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'实际不含税金额')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'实际不含税金额', N'实际不含税金额', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'实际不含税金额' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'实际不含税金额', 'en', N'Act Non Tax Amount', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'单位成本') IS NULL ALTER TABLE dbo.bl_so_order ADD [单位成本] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'单位成本')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'单位成本', N'单位成本', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'单位成本' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'单位成本', 'en', N'Unit Cost', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'成本') IS NULL ALTER TABLE dbo.bl_so_order ADD [成本] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'成本')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'成本', N'成本', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'成本' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'成本', 'en', N'Cost', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'本次核销金额') IS NULL ALTER TABLE dbo.bl_so_order ADD [本次核销金额] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'本次核销金额')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'本次核销金额', N'本次核销金额', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'本次核销金额' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'本次核销金额', 'en', N'Cur Settle Amount', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'折扣单价') IS NULL ALTER TABLE dbo.bl_so_order ADD [折扣单价] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'折扣单价')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'折扣单价', N'折扣单价', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'折扣单价' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'折扣单价', 'en', N'Dis Price', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'批次号') IS NULL ALTER TABLE dbo.bl_so_order ADD [批次号] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'批次号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'批次号', N'批次号', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'批次号' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'批次号', 'en', N'Batch No', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'产地') IS NULL ALTER TABLE dbo.bl_so_order ADD [产地] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'产地')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'产地', N'产地', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'产地' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'产地', 'en', N'Pro Place', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'注册证号') IS NULL ALTER TABLE dbo.bl_so_order ADD [注册证号] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'注册证号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'注册证号', N'注册证号', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'注册证号' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'注册证号', 'en', N'Pro Reg No', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'生产许可证号') IS NULL ALTER TABLE dbo.bl_so_order ADD [生产许可证号] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'生产许可证号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'生产许可证号', N'生产许可证号', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'生产许可证号' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'生产许可证号', 'en', N'Pro License', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'生产日期') IS NULL ALTER TABLE dbo.bl_so_order ADD [生产日期] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'生产日期')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'生产日期', N'生产日期', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'生产日期' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'生产日期', 'en', N'Kf Date', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'有效日期') IS NULL ALTER TABLE dbo.bl_so_order ADD [有效日期] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'有效日期')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'有效日期', N'有效日期', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'有效日期' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'有效日期', 'en', N'Valid Date', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'保质期类型，1') IS NULL ALTER TABLE dbo.bl_so_order ADD [保质期类型，1] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'保质期类型，1')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'保质期类型，1', N'保质期类型，1', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'保质期类型，1' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'保质期类型，1', 'en', N'Kf Type', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'保质期天数') IS NULL ALTER TABLE dbo.bl_so_order ADD [保质期天数] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'保质期天数')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'保质期天数', N'保质期天数', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'保质期天数' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'保质期天数', 'en', N'Kf Period', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'序列号格式') IS NULL ALTER TABLE dbo.bl_so_order ADD [序列号格式] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'序列号格式')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'序列号格式', N'序列号格式', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'序列号格式' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'序列号格式', 'en', N'Sn List', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'序列号流转ID') IS NULL ALTER TABLE dbo.bl_so_order ADD [序列号流转ID] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'序列号流转ID')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'序列号流转ID', N'序列号流转ID', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'序列号流转ID' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'序列号流转ID', 'en', N'Sn List Id', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'辅助单位id') IS NULL ALTER TABLE dbo.bl_so_order ADD [辅助单位id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'辅助单位id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'辅助单位id', N'辅助单位id', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助单位id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助单位id', 'en', N'Aux Unit Id', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'辅助单位名称') IS NULL ALTER TABLE dbo.bl_so_order ADD [辅助单位名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'辅助单位名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'辅助单位名称', N'辅助单位名称', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助单位名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助单位名称', 'en', N'Aux Unit Name', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'辅助单位编码') IS NULL ALTER TABLE dbo.bl_so_order ADD [辅助单位编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'辅助单位编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'辅助单位编码', N'辅助单位编码', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助单位编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助单位编码', 'en', N'Aux Unit Number', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'辅助换算率') IS NULL ALTER TABLE dbo.bl_so_order ADD [辅助换算率] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'辅助换算率')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'辅助换算率', N'辅助换算率', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助换算率' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助换算率', 'en', N'Aux Coefficient', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'辅助单位数量') IS NULL ALTER TABLE dbo.bl_so_order ADD [辅助单位数量] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'辅助单位数量')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'辅助单位数量', N'辅助单位数量', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助单位数量' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助单位数量', 'en', N'Aux Qty', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'分录序号') IS NULL ALTER TABLE dbo.bl_so_order ADD [分录序号] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'分录序号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'分录序号', N'分录序号', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'分录序号' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'分录序号', 'en', N'Seq', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'分录核销状态，未收款') IS NULL ALTER TABLE dbo.bl_so_order ADD [分录核销状态，未收款] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'分录核销状态，未收款')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'分录核销状态，未收款', N'分录核销状态，未收款', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'分录核销状态，未收款' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'分录核销状态，未收款', 'en', N'Entry Settle Status', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'是否赠品') IS NULL ALTER TABLE dbo.bl_so_order ADD [是否赠品] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'是否赠品')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'是否赠品', N'是否赠品', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'是否赠品' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'是否赠品', 'en', N'Is Free', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'源单id') IS NULL ALTER TABLE dbo.bl_so_order ADD [源单id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'源单id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'源单id', N'源单id', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'源单id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'源单id', 'en', N'Src Order Id', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'源单id_src_bill_no') IS NULL ALTER TABLE dbo.bl_so_order ADD [源单id_src_bill_no] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'源单id_src_bill_no')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'源单id_src_bill_no', N'源单id_src_bill_no', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'源单id_src_bill_no' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'源单id_src_bill_no', 'en', N'Src Bill No', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'源单类型id') IS NULL ALTER TABLE dbo.bl_so_order ADD [源单类型id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'源单类型id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'源单类型id', N'源单类型id', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'源单类型id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'源单类型id', 'en', N'Src Bill Type Id', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'源单类型名称') IS NULL ALTER TABLE dbo.bl_so_order ADD [源单类型名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'源单类型名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'源单类型名称', N'源单类型名称', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'源单类型名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'源单类型名称', 'en', N'Src Bill Type Name', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'源单类型编码') IS NULL ALTER TABLE dbo.bl_so_order ADD [源单类型编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'源单类型编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'源单类型编码', N'源单类型编码', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'源单类型编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'源单类型编码', 'en', N'Src Bill Type Number', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'源单id_src_inter_id') IS NULL ALTER TABLE dbo.bl_so_order ADD [源单id_src_inter_id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'源单id_src_inter_id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'源单id_src_inter_id', N'源单id_src_inter_id', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'源单id_src_inter_id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'源单id_src_inter_id', 'en', N'Src Inter Id', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'源单日期') IS NULL ALTER TABLE dbo.bl_so_order ADD [源单日期] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'源单日期')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'源单日期', N'源单日期', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'源单日期' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'源单日期', 'en', N'Src Bill Date', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'源单行号') IS NULL ALTER TABLE dbo.bl_so_order ADD [源单行号] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'源单行号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'源单行号', N'源单行号', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'源单行号' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'源单行号', 'en', N'Src Seq', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'源单分录id') IS NULL ALTER TABLE dbo.bl_so_order ADD [源单分录id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'源单分录id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'源单分录id', N'源单分录id', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'源单分录id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'源单分录id', 'en', N'Src Entry Id', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'单据整单折前价税合计_bill_dis_before_amount') IS NULL ALTER TABLE dbo.bl_so_order ADD [单据整单折前价税合计_bill_dis_before_amount] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'单据整单折前价税合计_bill_dis_before_amount')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'单据整单折前价税合计_bill_dis_before_amount', N'单据整单折前价税合计_bill_dis_before_amount', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'单据整单折前价税合计_bill_dis_before_amount' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'单据整单折前价税合计_bill_dis_before_amount', 'en', N'Bill Dis Before Amount', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'外部商品编码') IS NULL ALTER TABLE dbo.bl_so_order ADD [外部商品编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'外部商品编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'外部商品编码', N'外部商品编码', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'外部商品编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'外部商品编码', 'en', N'Outside Material Number', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'外部商品单位') IS NULL ALTER TABLE dbo.bl_so_order ADD [外部商品单位] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'外部商品单位')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'外部商品单位', N'外部商品单位', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'外部商品单位' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'外部商品单位', 'en', N'Outside Material Unit', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'基本数量') IS NULL ALTER TABLE dbo.bl_so_order ADD [基本数量] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'基本数量')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'基本数量', N'基本数量', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'基本数量' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'基本数量', 'en', N'Base Qty', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'已执行基本单位数量') IS NULL ALTER TABLE dbo.bl_so_order ADD [已执行基本单位数量] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'已执行基本单位数量')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'已执行基本单位数量', N'已执行基本单位数量', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'已执行基本单位数量' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'已执行基本单位数量', 'en', N'Out Base Qty', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'行已执行数量') IS NULL ALTER TABLE dbo.bl_so_order ADD [行已执行数量] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'行已执行数量')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'行已执行数量', N'行已执行数量', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'行已执行数量' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'行已执行数量', 'en', N'Out Qty', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'行未执行数量') IS NULL ALTER TABLE dbo.bl_so_order ADD [行未执行数量] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'行未执行数量')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'行未执行数量', N'行未执行数量', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'行未执行数量' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'行未执行数量', 'en', N'Un Out Qty', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'行执行已出库数量') IS NULL ALTER TABLE dbo.bl_so_order ADD [行执行已出库数量] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'行执行已出库数量')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'行执行已出库数量', N'行执行已出库数量', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'行执行已出库数量' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'行执行已出库数量', 'en', N'Real Out Qty', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'行执行未出库数量') IS NULL ALTER TABLE dbo.bl_so_order ADD [行执行未出库数量] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'行执行未出库数量')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'行执行未出库数量', N'行执行未出库数量', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'行执行未出库数量' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'行执行未出库数量', 'en', N'Real Un Out Qty', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'客户订单号') IS NULL ALTER TABLE dbo.bl_so_order ADD [客户订单号] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'客户订单号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'客户订单号', N'客户订单号', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'客户订单号' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'客户订单号', 'en', N'Cus Bill No', 'manual');
IF COL_LENGTH('dbo.bl_so_order', N'含税折扣额') IS NULL ALTER TABLE dbo.bl_so_order ADD [含税折扣额] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'含税折扣额')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'含税折扣额', N'含税折扣额', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'含税折扣额' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'含税折扣额', 'en', N'Dis Tax Amount', 'manual');
GO

-- ══ PU_ORDER 行子实体:补 83 列 ══
IF COL_LENGTH('dbo.bl_pu_order', N'图片url') IS NULL ALTER TABLE dbo.bl_pu_order ADD [图片url] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'图片url')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'图片url', N'图片url', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'图片url' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'图片url', 'en', N'Picture', 'manual');
IF COL_LENGTH('dbo.bl_pu_order', N'商品id') IS NULL ALTER TABLE dbo.bl_pu_order ADD [商品id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'商品id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'商品id', N'商品id', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'商品id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'商品id', 'en', N'Material Id', 'manual');
IF COL_LENGTH('dbo.bl_pu_order', N'商品是否多单位') IS NULL ALTER TABLE dbo.bl_pu_order ADD [商品是否多单位] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'商品是否多单位')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'商品是否多单位', N'商品是否多单位', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'商品是否多单位' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'商品是否多单位', 'en', N'Material Is Multi Unit', 'manual');
IF COL_LENGTH('dbo.bl_pu_order', N'商品是否序列号') IS NULL ALTER TABLE dbo.bl_pu_order ADD [商品是否序列号] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'商品是否序列号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'商品是否序列号', N'商品是否序列号', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'商品是否序列号' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'商品是否序列号', 'en', N'Material Is Serial', 'manual');
IF COL_LENGTH('dbo.bl_pu_order', N'商品是否启用辅助属性') IS NULL ALTER TABLE dbo.bl_pu_order ADD [商品是否启用辅助属性] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'商品是否启用辅助属性')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'商品是否启用辅助属性', N'商品是否启用辅助属性', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'商品是否启用辅助属性' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'商品是否启用辅助属性', 'en', N'Material Is Asst Attr', 'manual');
IF COL_LENGTH('dbo.bl_pu_order', N'商品是否开启批次') IS NULL ALTER TABLE dbo.bl_pu_order ADD [商品是否开启批次] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'商品是否开启批次')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'商品是否开启批次', N'商品是否开启批次', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'商品是否开启批次' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'商品是否开启批次', 'en', N'Material Is Batch', 'manual');
IF COL_LENGTH('dbo.bl_pu_order', N'商品助记码') IS NULL ALTER TABLE dbo.bl_pu_order ADD [商品助记码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'商品助记码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'商品助记码', N'商品助记码', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'商品助记码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'商品助记码', 'en', N'Material Help Code', 'manual');
IF COL_LENGTH('dbo.bl_pu_order', N'仓库id') IS NULL ALTER TABLE dbo.bl_pu_order ADD [仓库id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'仓库id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'仓库id', N'仓库id', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'仓库id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'仓库id', 'en', N'Stock Id', 'manual');
IF COL_LENGTH('dbo.bl_pu_order', N'仓库编码') IS NULL ALTER TABLE dbo.bl_pu_order ADD [仓库编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'仓库编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'仓库编码', N'仓库编码', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'仓库编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'仓库编码', 'en', N'Stock Number', 'manual');
IF COL_LENGTH('dbo.bl_pu_order', N'仓库启用仓位管理') IS NULL ALTER TABLE dbo.bl_pu_order ADD [仓库启用仓位管理] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'仓库启用仓位管理')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'仓库启用仓位管理', N'仓库启用仓位管理', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'仓库启用仓位管理' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'仓库启用仓位管理', 'en', N'Stock Is Allow Freight', 'manual');
IF COL_LENGTH('dbo.bl_pu_order', N'仓位id') IS NULL ALTER TABLE dbo.bl_pu_order ADD [仓位id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'仓位id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'仓位id', N'仓位id', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'仓位id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'仓位id', 'en', N'Sp Id', 'manual');
IF COL_LENGTH('dbo.bl_pu_order', N'仓位名称') IS NULL ALTER TABLE dbo.bl_pu_order ADD [仓位名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'仓位名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'仓位名称', N'仓位名称', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'仓位名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'仓位名称', 'en', N'Sp Name', 'manual');
IF COL_LENGTH('dbo.bl_pu_order', N'仓位编码') IS NULL ALTER TABLE dbo.bl_pu_order ADD [仓位编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'仓位编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'仓位编码', N'仓位编码', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'仓位编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'仓位编码', 'en', N'Sp Number', 'manual');
IF COL_LENGTH('dbo.bl_pu_order', N'辅助属性id') IS NULL ALTER TABLE dbo.bl_pu_order ADD [辅助属性id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'辅助属性id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'辅助属性id', N'辅助属性id', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助属性id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助属性id', 'en', N'Aux Prop Id', 'manual');
IF COL_LENGTH('dbo.bl_pu_order', N'辅助属性名称') IS NULL ALTER TABLE dbo.bl_pu_order ADD [辅助属性名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'辅助属性名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'辅助属性名称', N'辅助属性名称', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助属性名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助属性名称', 'en', N'Aux Prop Name', 'manual');
IF COL_LENGTH('dbo.bl_pu_order', N'辅助属性编码') IS NULL ALTER TABLE dbo.bl_pu_order ADD [辅助属性编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'辅助属性编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'辅助属性编码', N'辅助属性编码', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助属性编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助属性编码', 'en', N'Aux Prop Number', 'manual');
IF COL_LENGTH('dbo.bl_pu_order', N'辅助属性1id') IS NULL ALTER TABLE dbo.bl_pu_order ADD [辅助属性1id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'辅助属性1id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'辅助属性1id', N'辅助属性1id', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助属性1id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助属性1id', 'en', N'Aux Id1', 'manual');
IF COL_LENGTH('dbo.bl_pu_order', N'辅助属性1名称') IS NULL ALTER TABLE dbo.bl_pu_order ADD [辅助属性1名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'辅助属性1名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'辅助属性1名称', N'辅助属性1名称', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助属性1名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助属性1名称', 'en', N'Aux Name1', 'manual');
IF COL_LENGTH('dbo.bl_pu_order', N'辅助属性1编码') IS NULL ALTER TABLE dbo.bl_pu_order ADD [辅助属性1编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'辅助属性1编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'辅助属性1编码', N'辅助属性1编码', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助属性1编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助属性1编码', 'en', N'Aux Number1', 'manual');
IF COL_LENGTH('dbo.bl_pu_order', N'辅助属性2id') IS NULL ALTER TABLE dbo.bl_pu_order ADD [辅助属性2id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'辅助属性2id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'辅助属性2id', N'辅助属性2id', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助属性2id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助属性2id', 'en', N'Aux Id2', 'manual');
IF COL_LENGTH('dbo.bl_pu_order', N'辅助属性2名称') IS NULL ALTER TABLE dbo.bl_pu_order ADD [辅助属性2名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'辅助属性2名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'辅助属性2名称', N'辅助属性2名称', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助属性2名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助属性2名称', 'en', N'Aux Name2', 'manual');
IF COL_LENGTH('dbo.bl_pu_order', N'辅助属性2编码') IS NULL ALTER TABLE dbo.bl_pu_order ADD [辅助属性2编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'辅助属性2编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'辅助属性2编码', N'辅助属性2编码', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助属性2编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助属性2编码', 'en', N'Aux Number2', 'manual');
IF COL_LENGTH('dbo.bl_pu_order', N'辅助属性3id') IS NULL ALTER TABLE dbo.bl_pu_order ADD [辅助属性3id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'辅助属性3id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'辅助属性3id', N'辅助属性3id', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助属性3id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助属性3id', 'en', N'Aux Id3', 'manual');
IF COL_LENGTH('dbo.bl_pu_order', N'辅助属性3名称') IS NULL ALTER TABLE dbo.bl_pu_order ADD [辅助属性3名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'辅助属性3名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'辅助属性3名称', N'辅助属性3名称', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助属性3名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助属性3名称', 'en', N'Aux Name3', 'manual');
IF COL_LENGTH('dbo.bl_pu_order', N'辅助属性3编码') IS NULL ALTER TABLE dbo.bl_pu_order ADD [辅助属性3编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'辅助属性3编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'辅助属性3编码', N'辅助属性3编码', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助属性3编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助属性3编码', 'en', N'Aux Number3', 'manual');
IF COL_LENGTH('dbo.bl_pu_order', N'条形码') IS NULL ALTER TABLE dbo.bl_pu_order ADD [条形码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'条形码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'条形码', N'条形码', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'条形码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'条形码', 'en', N'Barcode', 'manual');
IF COL_LENGTH('dbo.bl_pu_order', N'实际含税单价') IS NULL ALTER TABLE dbo.bl_pu_order ADD [实际含税单价] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'实际含税单价')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'实际含税单价', N'实际含税单价', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'实际含税单价' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'实际含税单价', 'en', N'Act Tax Price', 'manual');
IF COL_LENGTH('dbo.bl_pu_order', N'基本单位id') IS NULL ALTER TABLE dbo.bl_pu_order ADD [基本单位id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'基本单位id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'基本单位id', N'基本单位id', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'基本单位id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'基本单位id', 'en', N'Base Unit Id', 'manual');
IF COL_LENGTH('dbo.bl_pu_order', N'基本单位名称') IS NULL ALTER TABLE dbo.bl_pu_order ADD [基本单位名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'基本单位名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'基本单位名称', N'基本单位名称', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'基本单位名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'基本单位名称', 'en', N'Base Unit Name', 'manual');
IF COL_LENGTH('dbo.bl_pu_order', N'基本单位编码') IS NULL ALTER TABLE dbo.bl_pu_order ADD [基本单位编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'基本单位编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'基本单位编码', N'基本单位编码', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'基本单位编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'基本单位编码', 'en', N'Base Unit Number', 'manual');
IF COL_LENGTH('dbo.bl_pu_order', N'单位id') IS NULL ALTER TABLE dbo.bl_pu_order ADD [单位id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'单位id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'单位id', N'单位id', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'单位id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'单位id', 'en', N'Unit Id', 'manual');
IF COL_LENGTH('dbo.bl_pu_order', N'单位编码') IS NULL ALTER TABLE dbo.bl_pu_order ADD [单位编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'单位编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'单位编码', N'单位编码', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'单位编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'单位编码', 'en', N'Unit Number', 'manual');
IF COL_LENGTH('dbo.bl_pu_order', N'换算率') IS NULL ALTER TABLE dbo.bl_pu_order ADD [换算率] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'换算率')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'换算率', N'换算率', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'换算率' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'换算率', 'en', N'Coefficient', 'manual');
IF COL_LENGTH('dbo.bl_pu_order', N'换算公式') IS NULL ALTER TABLE dbo.bl_pu_order ADD [换算公式] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'换算公式')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'换算公式', N'换算公式', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'换算公式' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'换算公式', 'en', N'Conversion Rate', 'manual');
IF COL_LENGTH('dbo.bl_pu_order', N'基本库存数量') IS NULL ALTER TABLE dbo.bl_pu_order ADD [基本库存数量] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'基本库存数量')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'基本库存数量', N'基本库存数量', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'基本库存数量' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'基本库存数量', 'en', N'Inv Base Qty', 'manual');
IF COL_LENGTH('dbo.bl_pu_order', N'退货数量') IS NULL ALTER TABLE dbo.bl_pu_order ADD [退货数量] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'退货数量')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'退货数量', N'退货数量', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'退货数量' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'退货数量', 'en', N'Return Qty Unit', 'manual');
IF COL_LENGTH('dbo.bl_pu_order', N'退货基本数量') IS NULL ALTER TABLE dbo.bl_pu_order ADD [退货基本数量] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'退货基本数量')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'退货基本数量', N'退货基本数量', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'退货基本数量' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'退货基本数量', 'en', N'Return Qty', 'manual');
IF COL_LENGTH('dbo.bl_pu_order', N'税额') IS NULL ALTER TABLE dbo.bl_pu_order ADD [税额] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'税额')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'税额', N'税额', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'税额' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'税额', 'en', N'Tax Amount', 'manual');
IF COL_LENGTH('dbo.bl_pu_order', N'整单折扣分配额') IS NULL ALTER TABLE dbo.bl_pu_order ADD [整单折扣分配额] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'整单折扣分配额')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'整单折扣分配额', N'整单折扣分配额', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'整单折扣分配额' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'整单折扣分配额', 'en', N'Bill Dis Distribution', 'manual');
IF COL_LENGTH('dbo.bl_pu_order', N'折扣') IS NULL ALTER TABLE dbo.bl_pu_order ADD [折扣] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'折扣')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'折扣', N'折扣', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'折扣' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'折扣', 'en', N'Discount', 'manual');
IF COL_LENGTH('dbo.bl_pu_order', N'销售费用分摊') IS NULL ALTER TABLE dbo.bl_pu_order ADD [销售费用分摊] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'销售费用分摊')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'销售费用分摊', N'销售费用分摊', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'销售费用分摊' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'销售费用分摊', 'en', N'Fee', 'manual');
IF COL_LENGTH('dbo.bl_pu_order', N'优惠分摊金额') IS NULL ALTER TABLE dbo.bl_pu_order ADD [优惠分摊金额] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'优惠分摊金额')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'优惠分摊金额', N'优惠分摊金额', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'优惠分摊金额' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'优惠分摊金额', 'en', N'Divide Diff Amount', 'manual');
IF COL_LENGTH('dbo.bl_pu_order', N'折前金额') IS NULL ALTER TABLE dbo.bl_pu_order ADD [折前金额] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'折前金额')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'折前金额', N'折前金额', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'折前金额' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'折前金额', 'en', N'Pre Dis Amount', 'manual');
IF COL_LENGTH('dbo.bl_pu_order', N'实际不含税金额') IS NULL ALTER TABLE dbo.bl_pu_order ADD [实际不含税金额] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'实际不含税金额')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'实际不含税金额', N'实际不含税金额', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'实际不含税金额' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'实际不含税金额', 'en', N'Act Non Tax Amount', 'manual');
IF COL_LENGTH('dbo.bl_pu_order', N'单位成本') IS NULL ALTER TABLE dbo.bl_pu_order ADD [单位成本] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'单位成本')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'单位成本', N'单位成本', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'单位成本' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'单位成本', 'en', N'Unit Cost', 'manual');
IF COL_LENGTH('dbo.bl_pu_order', N'成本') IS NULL ALTER TABLE dbo.bl_pu_order ADD [成本] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'成本')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'成本', N'成本', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'成本' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'成本', 'en', N'Cost', 'manual');
IF COL_LENGTH('dbo.bl_pu_order', N'本次核销金额') IS NULL ALTER TABLE dbo.bl_pu_order ADD [本次核销金额] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'本次核销金额')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'本次核销金额', N'本次核销金额', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'本次核销金额' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'本次核销金额', 'en', N'Cur Settle Amount', 'manual');
IF COL_LENGTH('dbo.bl_pu_order', N'折扣单价') IS NULL ALTER TABLE dbo.bl_pu_order ADD [折扣单价] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'折扣单价')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'折扣单价', N'折扣单价', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'折扣单价' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'折扣单价', 'en', N'Dis Price', 'manual');
IF COL_LENGTH('dbo.bl_pu_order', N'批次号') IS NULL ALTER TABLE dbo.bl_pu_order ADD [批次号] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'批次号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'批次号', N'批次号', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'批次号' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'批次号', 'en', N'Batch No', 'manual');
IF COL_LENGTH('dbo.bl_pu_order', N'产地') IS NULL ALTER TABLE dbo.bl_pu_order ADD [产地] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'产地')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'产地', N'产地', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'产地' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'产地', 'en', N'Pro Place', 'manual');
IF COL_LENGTH('dbo.bl_pu_order', N'注册证号') IS NULL ALTER TABLE dbo.bl_pu_order ADD [注册证号] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'注册证号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'注册证号', N'注册证号', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'注册证号' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'注册证号', 'en', N'Pro Reg No', 'manual');
IF COL_LENGTH('dbo.bl_pu_order', N'生产许可证号') IS NULL ALTER TABLE dbo.bl_pu_order ADD [生产许可证号] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'生产许可证号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'生产许可证号', N'生产许可证号', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'生产许可证号' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'生产许可证号', 'en', N'Pro License', 'manual');
IF COL_LENGTH('dbo.bl_pu_order', N'序列号格式') IS NULL ALTER TABLE dbo.bl_pu_order ADD [序列号格式] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'序列号格式')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'序列号格式', N'序列号格式', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'序列号格式' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'序列号格式', 'en', N'Sn List', 'manual');
IF COL_LENGTH('dbo.bl_pu_order', N'序列号流转ID') IS NULL ALTER TABLE dbo.bl_pu_order ADD [序列号流转ID] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'序列号流转ID')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'序列号流转ID', N'序列号流转ID', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'序列号流转ID' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'序列号流转ID', 'en', N'Sn List Id', 'manual');
IF COL_LENGTH('dbo.bl_pu_order', N'辅助单位id') IS NULL ALTER TABLE dbo.bl_pu_order ADD [辅助单位id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'辅助单位id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'辅助单位id', N'辅助单位id', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助单位id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助单位id', 'en', N'Aux Unit Id', 'manual');
IF COL_LENGTH('dbo.bl_pu_order', N'辅助单位编码') IS NULL ALTER TABLE dbo.bl_pu_order ADD [辅助单位编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'辅助单位编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'辅助单位编码', N'辅助单位编码', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助单位编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助单位编码', 'en', N'Aux Unit Number', 'manual');
IF COL_LENGTH('dbo.bl_pu_order', N'辅助换算率') IS NULL ALTER TABLE dbo.bl_pu_order ADD [辅助换算率] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'辅助换算率')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'辅助换算率', N'辅助换算率', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助换算率' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助换算率', 'en', N'Aux Coefficient', 'manual');
IF COL_LENGTH('dbo.bl_pu_order', N'分录序号') IS NULL ALTER TABLE dbo.bl_pu_order ADD [分录序号] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'分录序号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'分录序号', N'分录序号', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'分录序号' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'分录序号', 'en', N'Seq', 'manual');
IF COL_LENGTH('dbo.bl_pu_order', N'分录核销状态，未收款') IS NULL ALTER TABLE dbo.bl_pu_order ADD [分录核销状态，未收款] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'分录核销状态，未收款')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'分录核销状态，未收款', N'分录核销状态，未收款', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'分录核销状态，未收款' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'分录核销状态，未收款', 'en', N'Entry Settle Status', 'manual');
IF COL_LENGTH('dbo.bl_pu_order', N'是否赠品') IS NULL ALTER TABLE dbo.bl_pu_order ADD [是否赠品] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'是否赠品')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'是否赠品', N'是否赠品', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'是否赠品' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'是否赠品', 'en', N'Is Free', 'manual');
IF COL_LENGTH('dbo.bl_pu_order', N'源单id') IS NULL ALTER TABLE dbo.bl_pu_order ADD [源单id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'源单id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'源单id', N'源单id', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'源单id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'源单id', 'en', N'Src Order Id', 'manual');
IF COL_LENGTH('dbo.bl_pu_order', N'源单id_src_bill_no') IS NULL ALTER TABLE dbo.bl_pu_order ADD [源单id_src_bill_no] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'源单id_src_bill_no')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'源单id_src_bill_no', N'源单id_src_bill_no', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'源单id_src_bill_no' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'源单id_src_bill_no', 'en', N'Src Bill No', 'manual');
IF COL_LENGTH('dbo.bl_pu_order', N'源单类型id') IS NULL ALTER TABLE dbo.bl_pu_order ADD [源单类型id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'源单类型id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'源单类型id', N'源单类型id', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'源单类型id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'源单类型id', 'en', N'Src Bill Type Id', 'manual');
IF COL_LENGTH('dbo.bl_pu_order', N'源单类型名称') IS NULL ALTER TABLE dbo.bl_pu_order ADD [源单类型名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'源单类型名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'源单类型名称', N'源单类型名称', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'源单类型名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'源单类型名称', 'en', N'Src Bill Type Name', 'manual');
IF COL_LENGTH('dbo.bl_pu_order', N'源单类型编码') IS NULL ALTER TABLE dbo.bl_pu_order ADD [源单类型编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'源单类型编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'源单类型编码', N'源单类型编码', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'源单类型编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'源单类型编码', 'en', N'Src Bill Type Number', 'manual');
IF COL_LENGTH('dbo.bl_pu_order', N'源单id_src_inter_id') IS NULL ALTER TABLE dbo.bl_pu_order ADD [源单id_src_inter_id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'源单id_src_inter_id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'源单id_src_inter_id', N'源单id_src_inter_id', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'源单id_src_inter_id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'源单id_src_inter_id', 'en', N'Src Inter Id', 'manual');
IF COL_LENGTH('dbo.bl_pu_order', N'源单日期') IS NULL ALTER TABLE dbo.bl_pu_order ADD [源单日期] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'源单日期')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'源单日期', N'源单日期', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'源单日期' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'源单日期', 'en', N'Src Bill Date', 'manual');
IF COL_LENGTH('dbo.bl_pu_order', N'源单行号') IS NULL ALTER TABLE dbo.bl_pu_order ADD [源单行号] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'源单行号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'源单行号', N'源单行号', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'源单行号' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'源单行号', 'en', N'Src Seq', 'manual');
IF COL_LENGTH('dbo.bl_pu_order', N'源单分录id') IS NULL ALTER TABLE dbo.bl_pu_order ADD [源单分录id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'源单分录id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'源单分录id', N'源单分录id', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'源单分录id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'源单分录id', 'en', N'Src Entry Id', 'manual');
IF COL_LENGTH('dbo.bl_pu_order', N'供应商商品编码') IS NULL ALTER TABLE dbo.bl_pu_order ADD [供应商商品编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'供应商商品编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'供应商商品编码', N'供应商商品编码', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'供应商商品编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'供应商商品编码', 'en', N'Supp Material Number', 'manual');
IF COL_LENGTH('dbo.bl_pu_order', N'供应商商品名称') IS NULL ALTER TABLE dbo.bl_pu_order ADD [供应商商品名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'供应商商品名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'供应商商品名称', N'供应商商品名称', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'供应商商品名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'供应商商品名称', 'en', N'Supp Material Name', 'manual');
IF COL_LENGTH('dbo.bl_pu_order', N'行已执行数量') IS NULL ALTER TABLE dbo.bl_pu_order ADD [行已执行数量] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'行已执行数量')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'行已执行数量', N'行已执行数量', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'行已执行数量' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'行已执行数量', 'en', N'In Qty', 'manual');
IF COL_LENGTH('dbo.bl_pu_order', N'行关闭状态') IS NULL ALTER TABLE dbo.bl_pu_order ADD [行关闭状态] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'行关闭状态')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'行关闭状态', N'行关闭状态', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'行关闭状态' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'行关闭状态', 'en', N'Close State', 'manual');
IF COL_LENGTH('dbo.bl_pu_order', N'基本数量') IS NULL ALTER TABLE dbo.bl_pu_order ADD [基本数量] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'基本数量')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'基本数量', N'基本数量', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'基本数量' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'基本数量', 'en', N'Base Qty', 'manual');
IF COL_LENGTH('dbo.bl_pu_order', N'行入库状态') IS NULL ALTER TABLE dbo.bl_pu_order ADD [行入库状态] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'行入库状态')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'行入库状态', N'行入库状态', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'行入库状态' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'行入库状态', 'en', N'Entry Realio Status', 'manual');
IF COL_LENGTH('dbo.bl_pu_order', N'行执行状态') IS NULL ALTER TABLE dbo.bl_pu_order ADD [行执行状态] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'行执行状态')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'行执行状态', N'行执行状态', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'行执行状态' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'行执行状态', 'en', N'Entry Ios Tatus', 'manual');
IF COL_LENGTH('dbo.bl_pu_order', N'应付金额本位币') IS NULL ALTER TABLE dbo.bl_pu_order ADD [应付金额本位币] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'应付金额本位币')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'应付金额本位币', N'应付金额本位币', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'应付金额本位币' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'应付金额本位币', 'en', N'All Amount For', 'manual');
IF COL_LENGTH('dbo.bl_pu_order', N'含税折扣额') IS NULL ALTER TABLE dbo.bl_pu_order ADD [含税折扣额] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'含税折扣额')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'含税折扣额', N'含税折扣额', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'含税折扣额' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'含税折扣额', 'en', N'Dis Tax Amount', 'manual');
IF COL_LENGTH('dbo.bl_pu_order', N'行未执行数量') IS NULL ALTER TABLE dbo.bl_pu_order ADD [行未执行数量] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'行未执行数量')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'行未执行数量', N'行未执行数量', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'行未执行数量' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'行未执行数量', 'en', N'Un Out Qty', 'manual');
IF COL_LENGTH('dbo.bl_pu_order', N'保质期到期日') IS NULL ALTER TABLE dbo.bl_pu_order ADD [保质期到期日] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'保质期到期日')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'保质期到期日', N'保质期到期日', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'保质期到期日' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'保质期到期日', 'en', N'Kf Date', 'manual');
IF COL_LENGTH('dbo.bl_pu_order', N'有效期至') IS NULL ALTER TABLE dbo.bl_pu_order ADD [有效期至] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'有效期至')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'有效期至', N'有效期至', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'有效期至' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'有效期至', 'en', N'Valid Date', 'manual');
IF COL_LENGTH('dbo.bl_pu_order', N'保质期单位类型') IS NULL ALTER TABLE dbo.bl_pu_order ADD [保质期单位类型] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'保质期单位类型')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'保质期单位类型', N'保质期单位类型', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'保质期单位类型' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'保质期单位类型', 'en', N'Kf Type', 'manual');
IF COL_LENGTH('dbo.bl_pu_order', N'kf_period') IS NULL ALTER TABLE dbo.bl_pu_order ADD [kf_period] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_ORDER' AND col_name=N'kf_period')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('PU_ORDER', N'kf_period', N'kf_period', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'kf_period' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'kf_period', 'en', N'Kf Period', 'manual');
GO

-- ══ BD_CUSTOMER 联系人子实体:补 14 列 ══
IF COL_LENGTH('dbo.dm_kh', N'联系人创建时间') IS NULL ALTER TABLE dbo.dm_kh ADD [联系人创建时间] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='KHDA' AND col_name=N'联系人创建时间')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('KHDA', N'联系人创建时间', N'联系人创建时间', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'联系人创建时间' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'联系人创建时间', 'en', N'Contact Create Time Contact', 'manual');
IF COL_LENGTH('dbo.dm_kh', N'联系人国家-id') IS NULL ALTER TABLE dbo.dm_kh ADD [联系人国家-id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='KHDA' AND col_name=N'联系人国家-id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('KHDA', N'联系人国家-id', N'联系人国家-id', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'联系人国家-id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'联系人国家-id', 'en', N'Contact Contact Country Id', 'manual');
IF COL_LENGTH('dbo.dm_kh', N'国家-名称') IS NULL ALTER TABLE dbo.dm_kh ADD [国家-名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='KHDA' AND col_name=N'国家-名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('KHDA', N'国家-名称', N'国家-名称', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'国家-名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'国家-名称', 'en', N'Contact Contact Country Name', 'manual');
IF COL_LENGTH('dbo.dm_kh', N'国家-编码') IS NULL ALTER TABLE dbo.dm_kh ADD [国家-编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='KHDA' AND col_name=N'国家-编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('KHDA', N'国家-编码', N'国家-编码', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'国家-编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'国家-编码', 'en', N'Contact Contact Country Number', 'manual');
IF COL_LENGTH('dbo.dm_kh', N'联系人省-id') IS NULL ALTER TABLE dbo.dm_kh ADD [联系人省-id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='KHDA' AND col_name=N'联系人省-id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('KHDA', N'联系人省-id', N'联系人省-id', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'联系人省-id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'联系人省-id', 'en', N'Contact Contact Province Id', 'manual');
IF COL_LENGTH('dbo.dm_kh', N'省-名称') IS NULL ALTER TABLE dbo.dm_kh ADD [省-名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='KHDA' AND col_name=N'省-名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('KHDA', N'省-名称', N'省-名称', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'省-名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'省-名称', 'en', N'Contact Contact Province Name', 'manual');
IF COL_LENGTH('dbo.dm_kh', N'省-编码') IS NULL ALTER TABLE dbo.dm_kh ADD [省-编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='KHDA' AND col_name=N'省-编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('KHDA', N'省-编码', N'省-编码', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'省-编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'省-编码', 'en', N'Contact Contact Province Number', 'manual');
IF COL_LENGTH('dbo.dm_kh', N'联系人市-id') IS NULL ALTER TABLE dbo.dm_kh ADD [联系人市-id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='KHDA' AND col_name=N'联系人市-id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('KHDA', N'联系人市-id', N'联系人市-id', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'联系人市-id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'联系人市-id', 'en', N'Contact Contact City Id', 'manual');
IF COL_LENGTH('dbo.dm_kh', N'市-名称') IS NULL ALTER TABLE dbo.dm_kh ADD [市-名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='KHDA' AND col_name=N'市-名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('KHDA', N'市-名称', N'市-名称', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'市-名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'市-名称', 'en', N'Contact Contact City Name', 'manual');
IF COL_LENGTH('dbo.dm_kh', N'市-编码') IS NULL ALTER TABLE dbo.dm_kh ADD [市-编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='KHDA' AND col_name=N'市-编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('KHDA', N'市-编码', N'市-编码', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'市-编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'市-编码', 'en', N'Contact Contact City Number', 'manual');
IF COL_LENGTH('dbo.dm_kh', N'联系人区-id') IS NULL ALTER TABLE dbo.dm_kh ADD [联系人区-id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='KHDA' AND col_name=N'联系人区-id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('KHDA', N'联系人区-id', N'联系人区-id', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'联系人区-id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'联系人区-id', 'en', N'Contact Contact District Id', 'manual');
IF COL_LENGTH('dbo.dm_kh', N'区-名称') IS NULL ALTER TABLE dbo.dm_kh ADD [区-名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='KHDA' AND col_name=N'区-名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('KHDA', N'区-名称', N'区-名称', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'区-名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'区-名称', 'en', N'Contact Contact District Name', 'manual');
IF COL_LENGTH('dbo.dm_kh', N'区-编码') IS NULL ALTER TABLE dbo.dm_kh ADD [区-编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='KHDA' AND col_name=N'区-编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('KHDA', N'区-编码', N'区-编码', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'区-编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'区-编码', 'en', N'Contact Contact District Number', 'manual');
IF COL_LENGTH('dbo.dm_kh', N'联系人序号') IS NULL ALTER TABLE dbo.dm_kh ADD [联系人序号] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='KHDA' AND col_name=N'联系人序号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('KHDA', N'联系人序号', N'联系人序号', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'联系人序号' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'联系人序号', 'en', N'Contact Seq', 'manual');
GO

-- ══ BD_SUPPLIER 联系人子实体:补 20 列 ══
IF COL_LENGTH('dbo.dm_gf', N'生日') IS NULL ALTER TABLE dbo.dm_gf ADD [生日] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='GFDA' AND col_name=N'生日')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('GFDA', N'生日', N'生日', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'生日' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'生日', 'en', N'Contact Birthday', 'manual');
IF COL_LENGTH('dbo.dm_gf', N'QQ') IS NULL ALTER TABLE dbo.dm_gf ADD [QQ] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='GFDA' AND col_name=N'QQ')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('GFDA', N'QQ', N'QQ', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'QQ' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'QQ', 'en', N'Contact Qq', 'manual');
IF COL_LENGTH('dbo.dm_gf', N'国家-id') IS NULL ALTER TABLE dbo.dm_gf ADD [国家-id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='GFDA' AND col_name=N'国家-id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('GFDA', N'国家-id', N'国家-id', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'国家-id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'国家-id', 'en', N'Contact Contact Country Id', 'manual');
IF COL_LENGTH('dbo.dm_gf', N'国家-名称') IS NULL ALTER TABLE dbo.dm_gf ADD [国家-名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='GFDA' AND col_name=N'国家-名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('GFDA', N'国家-名称', N'国家-名称', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'国家-名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'国家-名称', 'en', N'Contact Contact Country Name', 'manual');
IF COL_LENGTH('dbo.dm_gf', N'国家-编码') IS NULL ALTER TABLE dbo.dm_gf ADD [国家-编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='GFDA' AND col_name=N'国家-编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('GFDA', N'国家-编码', N'国家-编码', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'国家-编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'国家-编码', 'en', N'Contact Contact Country Number', 'manual');
IF COL_LENGTH('dbo.dm_gf', N'省-id') IS NULL ALTER TABLE dbo.dm_gf ADD [省-id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='GFDA' AND col_name=N'省-id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('GFDA', N'省-id', N'省-id', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'省-id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'省-id', 'en', N'Contact Contact Province Id', 'manual');
IF COL_LENGTH('dbo.dm_gf', N'省-名称') IS NULL ALTER TABLE dbo.dm_gf ADD [省-名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='GFDA' AND col_name=N'省-名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('GFDA', N'省-名称', N'省-名称', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'省-名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'省-名称', 'en', N'Contact Contact Province Name', 'manual');
IF COL_LENGTH('dbo.dm_gf', N'省-编码') IS NULL ALTER TABLE dbo.dm_gf ADD [省-编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='GFDA' AND col_name=N'省-编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('GFDA', N'省-编码', N'省-编码', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'省-编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'省-编码', 'en', N'Contact Contact Province Number', 'manual');
IF COL_LENGTH('dbo.dm_gf', N'市-id') IS NULL ALTER TABLE dbo.dm_gf ADD [市-id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='GFDA' AND col_name=N'市-id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('GFDA', N'市-id', N'市-id', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'市-id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'市-id', 'en', N'Contact Contact City Id', 'manual');
IF COL_LENGTH('dbo.dm_gf', N'市-名称') IS NULL ALTER TABLE dbo.dm_gf ADD [市-名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='GFDA' AND col_name=N'市-名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('GFDA', N'市-名称', N'市-名称', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'市-名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'市-名称', 'en', N'Contact Contact City Name', 'manual');
IF COL_LENGTH('dbo.dm_gf', N'市-编码') IS NULL ALTER TABLE dbo.dm_gf ADD [市-编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='GFDA' AND col_name=N'市-编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('GFDA', N'市-编码', N'市-编码', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'市-编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'市-编码', 'en', N'Contact Contact City Number', 'manual');
IF COL_LENGTH('dbo.dm_gf', N'区-id') IS NULL ALTER TABLE dbo.dm_gf ADD [区-id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='GFDA' AND col_name=N'区-id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('GFDA', N'区-id', N'区-id', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'区-id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'区-id', 'en', N'Contact Contact District Id', 'manual');
IF COL_LENGTH('dbo.dm_gf', N'区-名称') IS NULL ALTER TABLE dbo.dm_gf ADD [区-名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='GFDA' AND col_name=N'区-名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('GFDA', N'区-名称', N'区-名称', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'区-名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'区-名称', 'en', N'Contact Contact District Name', 'manual');
IF COL_LENGTH('dbo.dm_gf', N'区-编码') IS NULL ALTER TABLE dbo.dm_gf ADD [区-编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='GFDA' AND col_name=N'区-编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('GFDA', N'区-编码', N'区-编码', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'区-编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'区-编码', 'en', N'Contact Contact District Number', 'manual');
IF COL_LENGTH('dbo.dm_gf', N'性别1-男2-女') IS NULL ALTER TABLE dbo.dm_gf ADD [性别1-男2-女] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='GFDA' AND col_name=N'性别1-男2-女')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('GFDA', N'性别1-男2-女', N'性别1-男2-女', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'性别1-男2-女' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'性别1-男2-女', 'en', N'Contact Gender', 'manual');
IF COL_LENGTH('dbo.dm_gf', N'微信') IS NULL ALTER TABLE dbo.dm_gf ADD [微信] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='GFDA' AND col_name=N'微信')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('GFDA', N'微信', N'微信', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'微信' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'微信', 'en', N'Contact Wechat', 'manual');
IF COL_LENGTH('dbo.dm_gf', N'是否首要联系人') IS NULL ALTER TABLE dbo.dm_gf ADD [是否首要联系人] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='GFDA' AND col_name=N'是否首要联系人')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('GFDA', N'是否首要联系人', N'是否首要联系人', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'是否首要联系人' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'是否首要联系人', 'en', N'Contact Is Default Linkman', 'manual');
IF COL_LENGTH('dbo.dm_gf', N'联系人序号') IS NULL ALTER TABLE dbo.dm_gf ADD [联系人序号] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='GFDA' AND col_name=N'联系人序号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('GFDA', N'联系人序号', N'联系人序号', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'联系人序号' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'联系人序号', 'en', N'Contact Seq', 'manual');
IF COL_LENGTH('dbo.dm_gf', N'分类编码') IS NULL ALTER TABLE dbo.dm_gf ADD [分类编码] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='GFDA' AND col_name=N'分类编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('GFDA', N'分类编码', N'分类编码', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'分类编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'分类编码', 'en', N'Contact Group Number', 'manual');
IF COL_LENGTH('dbo.dm_gf', N'税率') IS NULL ALTER TABLE dbo.dm_gf ADD [税率] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='GFDA' AND col_name=N'税率')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('GFDA', N'税率', N'税率', N'文本', N'detail', 960, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'税率' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'税率', 'en', N'Contact Rate', 'manual');
GO

PRINT N'migrate-kingdee-subentity-union 完成';
GO