-- migrate-kingdee-archive-align2.sql — 基础档案面板/字段对齐金蝶ERP(第二期:加字段+5个新面板+同步锚点)
-- 依据:deploy/基础资料同步实现指引.md §二字段映射 + §四.4 迁移模板 + deploy/面板字段对照.md(官方字段说明)。
-- 第一期(migrate-kingdee-archive-align.sql)已做:客户编码/供应商档案改名/联系人/业务员编码/仓库编码。
-- 本期:
--   1. 有则改(命名以金蝶的为准,仅改 label,col_name 不动——refField 存列名,refLabelOf 运行时转标签,引用安全):
--      KHDA 地址→详细地址(addr) / 客户级别→价格等级(c_level_name) / 税号→开票税号(taxpayer_no) / 开户行→开户银行(bank)
--      GFDA 税号→开票税号(taxpayer_no) / 开户行→开户银行(income_bank_name) / 业务员→采购员(saler_name)
--      UOM  小数位数→数量小数位(measure_unit.precision)
--   2. 无则加(字段):KHDA 客户分类(dm_kh.khlb 列已在,补 yj_field);GFDA 供应商分类(dm_gf 补 gysfl 列+字段);
--      INV 条形码(bs_inv 补列+字段,material.barcode);INV 数据来源字典补「金蝶同步」选项。
--   3. 无则加(面板):金蝶 12 基础资料中 MES 缺的 5 个(指引 §二.8-12 方案C 专表+注册面板):
--      结算方式 SETTLE/bs_settle_type、客户分类 CUSGRP/bs_customer_group、供应商分类 SUPGRP/bs_supplier_group、
--      商品分类 MATGRP/bs_material_group、币别 CUR/bs_currency(新表全带中文 MS_Description 注明)。
--   4. 同步锚点(指引 §四.4 模板,仅物理列不注册面板字段):7 张在用档案目标表
--      dm_kh/dm_gf/bs_inv/bs_emp/bs_dept/bs_wh/bs_uom 补 外部数据ID/外部单据号/外部指纹 + 唯一过滤索引。
--   5. 多语言译名(yj_translation,9 语言 en/ja/ko/de/es/fr/ru/th/vi,scope=panel+field)。
-- 幂等:UPDATE 直写同值 / IF NOT EXISTS / MERGE NOT MATCHED,可重复执行。
SET NOCOUNT ON;
GO

-- ══════════ 1. KHDA 客户档案:label 对齐金蝶命名(有则改) ══════════
UPDATE yj_field SET label = N'详细地址' WHERE panel_code = 'KHDA' AND col_name = 'addr';
UPDATE yj_field SET label = N'价格等级' WHERE panel_code = 'KHDA' AND col_name = 'khjb';
UPDATE yj_field SET label = N'开票税号' WHERE panel_code = 'KHDA' AND col_name = 'sui_no';
UPDATE yj_field SET label = N'开户银行' WHERE panel_code = 'KHDA' AND col_name = 'bank';
GO

-- ══════════ 2. KHDA 补字段:客户分类(group_name 类别-名称;dm_kh.khlb 物理列已在) ══════════
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'KHDA' AND col_name = 'khlb')
BEGIN
    UPDATE yj_field SET seq = seq + 1 WHERE panel_code = 'KHDA' AND seq >= 3;  -- 客户名称(2)之后插入,原 3..15 顺延
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
    VALUES ('KHDA', N'khlb', N'客户分类', N'文本', NULL, NULL, NULL, NULL, N'detail', 3, 120, 1, 0, 0, 1);
END
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('dbo.dm_kh') AND minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.dm_kh'), 'khlb', 'ColumnId') AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'客户分类(金蝶星辰 customer_group.group_name 口径,文本)', N'SCHEMA', N'dbo', N'TABLE', N'dm_kh', N'COLUMN', N'khlb';
GO

-- ══════════ 3. GFDA 供应商档案:label 对齐 + 补供应商分类字段 ══════════
UPDATE yj_field SET label = N'开票税号' WHERE panel_code = 'GFDA' AND col_name = 'sui_no';
UPDATE yj_field SET label = N'开户银行' WHERE panel_code = 'GFDA' AND col_name = 'bank';
UPDATE yj_field SET label = N'采购员'   WHERE panel_code = 'GFDA' AND col_name = 'ywman';
GO
IF COL_LENGTH('dbo.dm_gf', 'gysfl') IS NULL ALTER TABLE dbo.dm_gf ADD [gysfl] nvarchar(200) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('dbo.dm_gf') AND minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.dm_gf'), 'gysfl', 'ColumnId') AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'供应商分类(金蝶星辰 supplier_group.group_name 口径,文本)', N'SCHEMA', N'dbo', N'TABLE', N'dm_gf', N'COLUMN', N'gysfl';
GO
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'GFDA' AND col_name = 'gysfl')
BEGIN
    UPDATE yj_field SET seq = seq + 1 WHERE panel_code = 'GFDA' AND seq >= 3;  -- 供应商名称(2)之后插入,原 3..11 顺延
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
    VALUES ('GFDA', N'gysfl', N'供应商分类', N'文本', NULL, NULL, NULL, NULL, N'detail', 3, 120, 1, 0, 0, 1);
END
GO

-- ══════════ 4. UOM 计量单位:小数位数→数量小数位(measure_unit.precision) ══════════
UPDATE yj_field SET label = N'数量小数位' WHERE panel_code = 'UOM' AND col_name = N'小数位数';
GO

-- ══════════ 5. INV 存货:补条形码(material.barcode)+ 数据来源字典补「金蝶同步」 ══════════
IF COL_LENGTH('dbo.bs_inv', N'条形码') IS NULL ALTER TABLE dbo.bs_inv ADD [条形码] nvarchar(100) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('dbo.bs_inv') AND minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.bs_inv'), N'条形码', 'ColumnId') AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'条形码(金蝶星辰 material.barcode)', N'SCHEMA', N'dbo', N'TABLE', N'bs_inv', N'COLUMN', N'条形码';
GO
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'INV' AND col_name = N'条形码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
    VALUES ('INV', N'条形码', N'条形码', N'文本', NULL, NULL, NULL, NULL, N'detail', 45, 130, 1, 0, 0, 1);
GO
UPDATE yj_field SET dict_sql = N'SELECT v FROM (VALUES (N''ERP导入''),(N''手工''),(N''金蝶同步'')) AS t(v)'
WHERE panel_code = 'INV' AND col_name = N'数据来源';
GO

-- ══════════ 6. 新表:结算方式(金蝶 settlement_type:仅列表接口,字段 id/enable/is_default/name) ══════════
IF OBJECT_ID('dbo.bs_settle_type','U') IS NULL CREATE TABLE dbo.[bs_settle_type] (
  [id] int IDENTITY(1,1) NOT NULL,
  [名称] nvarchar(100) NOT NULL,                 -- settlement_type.name 名称
  [是否默认] bit NULL,                            -- settlement_type.is_default 是否默认
  [停用] bit NULL,                                -- enable(1启用/0禁用/-1不限)取反落位
  [备注] nvarchar(500) NULL,
  [状态] nvarchar(20) NOT NULL CONSTRAINT df_bs_settle_type_st DEFAULT(N'启用'),
  [外部数据ID] nvarchar(64) NULL,                 -- 金蝶 id,jdy-sync 幂等锚点
  [外部单据号] nvarchar(200) NULL,                 -- 备查(档案存金蝶编码)
  [外部指纹] nvarchar(500) NULL,                   -- 列表级字段指纹,跳过无变化行
  [asp_user1] nvarchar(50) NULL, [asp_time1] datetime2 NULL,
  [asp_user2] nvarchar(50) NULL, [asp_time2] datetime2 NULL,
  [asp_cancel] char(1) NULL DEFAULT('N'),
  CONSTRAINT pk_bs_settle_type PRIMARY KEY (id)
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ux_bs_settle_type_ext_id')
    CREATE UNIQUE INDEX ux_bs_settle_type_ext_id ON dbo.bs_settle_type([外部数据ID]) WHERE [外部数据ID] IS NOT NULL;
GO

-- ══════════ 7. 新表:客户分类(金蝶 customer_group:id/number/name/level/is_leaf/parent_id/remark) ══════════
IF OBJECT_ID('dbo.bs_customer_group','U') IS NULL CREATE TABLE dbo.[bs_customer_group] (
  [id] int IDENTITY(1,1) NOT NULL,
  [编码] nvarchar(100) NOT NULL,                  -- customer_group.number 编码
  [名称] nvarchar(200) NOT NULL,                  -- name 名称
  [级次] nvarchar(10) NULL,                       -- level 级次
  [是否叶子节点] bit NULL,                         -- is_leaf
  [上级编码] nvarchar(100) NULL,                   -- parent_id(同步时以 number 落表)
  [备注] nvarchar(500) NULL,                      -- remark 备注
  [停用] bit NULL,
  [状态] nvarchar(20) NOT NULL CONSTRAINT df_bs_cusgrp_st DEFAULT(N'启用'),
  [外部数据ID] nvarchar(64) NULL, [外部单据号] nvarchar(200) NULL, [外部指纹] nvarchar(500) NULL,
  [asp_user1] nvarchar(50) NULL, [asp_time1] datetime2 NULL,
  [asp_user2] nvarchar(50) NULL, [asp_time2] datetime2 NULL,
  [asp_cancel] char(1) NULL DEFAULT('N'),
  CONSTRAINT pk_bs_customer_group PRIMARY KEY (id)
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ux_bs_customer_group_ext_id')
    CREATE UNIQUE INDEX ux_bs_customer_group_ext_id ON dbo.bs_customer_group([外部数据ID]) WHERE [外部数据ID] IS NOT NULL;
GO

-- ══════════ 8. 新表:供应商分类(金蝶 supplier_group:id/number/name/level/is_leaf/parent_id) ══════════
IF OBJECT_ID('dbo.bs_supplier_group','U') IS NULL CREATE TABLE dbo.[bs_supplier_group] (
  [id] int IDENTITY(1,1) NOT NULL,
  [编码] nvarchar(100) NOT NULL,                  -- supplier_group.number 编码
  [名称] nvarchar(200) NOT NULL,                  -- name 名称
  [级次] nvarchar(10) NULL,                       -- level 级次
  [是否叶子节点] bit NULL,                         -- is_leaf
  [上级编码] nvarchar(100) NULL,                   -- parent_id(同步时以 number 落表)
  [停用] bit NULL,
  [状态] nvarchar(20) NOT NULL CONSTRAINT df_bs_supgrp_st DEFAULT(N'启用'),
  [外部数据ID] nvarchar(64) NULL, [外部单据号] nvarchar(200) NULL, [外部指纹] nvarchar(500) NULL,
  [asp_user1] nvarchar(50) NULL, [asp_time1] datetime2 NULL,
  [asp_user2] nvarchar(50) NULL, [asp_time2] datetime2 NULL,
  [asp_cancel] char(1) NULL DEFAULT('N'),
  CONSTRAINT pk_bs_supplier_group PRIMARY KEY (id)
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ux_bs_supplier_group_ext_id')
    CREATE UNIQUE INDEX ux_bs_supplier_group_ext_id ON dbo.bs_supplier_group([外部数据ID]) WHERE [外部数据ID] IS NOT NULL;
GO

-- ══════════ 9. 新表:商品分类(金蝶 material_group:id/number/name/level/is_leaf/parent_id) ══════════
IF OBJECT_ID('dbo.bs_material_group','U') IS NULL CREATE TABLE dbo.[bs_material_group] (
  [id] int IDENTITY(1,1) NOT NULL,
  [编码] nvarchar(100) NOT NULL,                  -- material_group.number 编码
  [名称] nvarchar(200) NOT NULL,                  -- name 名称
  [级次] nvarchar(10) NULL,                       -- level 级次
  [是否叶子节点] bit NULL,                         -- is_leaf
  [上级编码] nvarchar(100) NULL,                   -- parent_id(同步时以 number 落表)
  [停用] bit NULL,
  [状态] nvarchar(20) NOT NULL CONSTRAINT df_bs_matgrp_st DEFAULT(N'启用'),
  [外部数据ID] nvarchar(64) NULL, [外部单据号] nvarchar(200) NULL, [外部指纹] nvarchar(500) NULL,
  [asp_user1] nvarchar(50) NULL, [asp_time1] datetime2 NULL,
  [asp_user2] nvarchar(50) NULL, [asp_time2] datetime2 NULL,
  [asp_cancel] char(1) NULL DEFAULT('N'),
  CONSTRAINT pk_bs_material_group PRIMARY KEY (id)
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ux_bs_material_group_ext_id')
    CREATE UNIQUE INDEX ux_bs_material_group_ext_id ON dbo.bs_material_group([外部数据ID]) WHERE [外部数据ID] IS NOT NULL;
GO

-- ══════════ 10. 新表:币别(金蝶 currency:number/name/sign/rate/exc_type/amt_precision/price_precision/enable) ══════════
IF OBJECT_ID('dbo.bs_currency','U') IS NULL CREATE TABLE dbo.[bs_currency] (
  [id] int IDENTITY(1,1) NOT NULL,
  [编码] nvarchar(40) NOT NULL,                   -- currency.number 编码
  [名称] nvarchar(100) NOT NULL,                  -- name 名称
  [币别符号] nvarchar(20) NULL,                    -- sign 币别符号
  [汇率] decimal(18,6) NULL,                      -- rate(官方文档误写"税率",币别语义为汇率)
  [汇率类型] nvarchar(20) NULL,                    -- exc_type(1固定汇率/2浮动汇率)
  [金额小数位] int NULL,                           -- amt_precision
  [单价小数位] int NULL,                           -- price_precision
  [停用] bit NULL,                                -- enable(1启用/0禁用/-1不限)取反落位
  [状态] nvarchar(20) NOT NULL CONSTRAINT df_bs_currency_st DEFAULT(N'启用'),
  [外部数据ID] nvarchar(64) NULL, [外部单据号] nvarchar(200) NULL, [外部指纹] nvarchar(500) NULL,
  [asp_user1] nvarchar(50) NULL, [asp_time1] datetime2 NULL,
  [asp_user2] nvarchar(50) NULL, [asp_time2] datetime2 NULL,
  [asp_cancel] char(1) NULL DEFAULT('N'),
  CONSTRAINT pk_bs_currency PRIMARY KEY (id)
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ux_bs_currency_ext_id')
    CREATE UNIQUE INDEX ux_bs_currency_ext_id ON dbo.bs_currency([外部数据ID]) WHERE [外部数据ID] IS NOT NULL;
GO

-- ══════════ 11. 新表中文注明(表级,AGENTS.md 2026-09-14 强制) ══════════
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('dbo.bs_settle_type') AND minor_id = 0 AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'结算方式档案(金蝶云·星辰 settlement_type 同步目标表;名称=匹配列,外部数据ID=同步幂等锚点)', N'SCHEMA', N'dbo', N'TABLE', N'bs_settle_type';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('dbo.bs_customer_group') AND minor_id = 0 AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'客户分类档案(金蝶云·星辰 customer_group 同步目标表;编码=匹配列,外部数据ID=同步幂等锚点)', N'SCHEMA', N'dbo', N'TABLE', N'bs_customer_group';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('dbo.bs_supplier_group') AND minor_id = 0 AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'供应商分类档案(金蝶云·星辰 supplier_group 同步目标表;编码=匹配列,外部数据ID=同步幂等锚点)', N'SCHEMA', N'dbo', N'TABLE', N'bs_supplier_group';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('dbo.bs_material_group') AND minor_id = 0 AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'商品分类档案(金蝶云·星辰 material_group 同步目标表;编码=匹配列,外部数据ID=同步幂等锚点)', N'SCHEMA', N'dbo', N'TABLE', N'bs_material_group';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('dbo.bs_currency') AND minor_id = 0 AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'币别档案(金蝶云·星辰 currency 同步目标表;编码=匹配列,外部数据ID=同步幂等锚点)', N'SCHEMA', N'dbo', N'TABLE', N'bs_currency';
GO

-- ══════════ 12. 新面板注册 yj_panel(archive 单单据结构,place 仅 detail) ══════════
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'SETTLE')
    INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, config, config_at, module_group, panel_name_en)
    VALUES ('SETTLE', N'结算方式', N'基础设置', N'archive', N'bs_settle_type', NULL, NULL, N'id', N'名称', NULL, NULL, 100, N'items', NULL, NULL, N'基础设置', N'Settlement Method');
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'CUSGRP')
    INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, config, config_at, module_group, panel_name_en)
    VALUES ('CUSGRP', N'客户分类', N'基础设置', N'archive', N'bs_customer_group', NULL, NULL, N'id', N'编码', NULL, NULL, 100, N'items', NULL, NULL, N'基础设置', N'Customer Group');
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'SUPGRP')
    INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, config, config_at, module_group, panel_name_en)
    VALUES ('SUPGRP', N'供应商分类', N'基础设置', N'archive', N'bs_supplier_group', NULL, NULL, N'id', N'编码', NULL, NULL, 100, N'items', NULL, NULL, N'基础设置', N'Supplier Group');
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'MATGRP')
    INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, config, config_at, module_group, panel_name_en)
    VALUES ('MATGRP', N'商品分类', N'基础设置', N'archive', N'bs_material_group', NULL, NULL, N'id', N'编码', NULL, NULL, 100, N'items', NULL, NULL, N'基础设置', N'Material Group');
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'CUR')
    INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, config, config_at, module_group, panel_name_en)
    VALUES ('CUR', N'币别', N'基础设置', N'archive', N'bs_currency', NULL, NULL, N'id', N'编码', NULL, NULL, 100, N'items', NULL, NULL, N'基础设置', N'Currency');
GO

-- ══════════ 13. 新面板字段 yj_field ══════════
-- SETTLE 结算方式
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'SETTLE' AND col_name = N'名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
    VALUES ('SETTLE', N'名称', N'名称', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 10, 200, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'SETTLE' AND col_name = N'是否默认')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
    VALUES ('SETTLE', N'是否默认', N'是否默认', N'是否', NULL, NULL, NULL, NULL, N'detail', 20, 90, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'SETTLE' AND col_name = N'停用')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
    VALUES ('SETTLE', N'停用', N'停用', N'是否', NULL, NULL, NULL, NULL, N'detail', 30, 80, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'SETTLE' AND col_name = N'备注')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
    VALUES ('SETTLE', N'备注', N'备注', N'文本', NULL, NULL, NULL, NULL, N'detail', 40, 260, 1, 0, 0, 1);
-- CUSGRP 客户分类
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'CUSGRP' AND col_name = N'编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
    VALUES ('CUSGRP', N'编码', N'编码', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 10, 140, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'CUSGRP' AND col_name = N'名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
    VALUES ('CUSGRP', N'名称', N'名称', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 20, 180, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'CUSGRP' AND col_name = N'级次')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
    VALUES ('CUSGRP', N'级次', N'级次', N'文本', NULL, NULL, NULL, NULL, N'detail', 30, 70, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'CUSGRP' AND col_name = N'是否叶子节点')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
    VALUES ('CUSGRP', N'是否叶子节点', N'是否叶子节点', N'是否', NULL, NULL, NULL, NULL, N'detail', 40, 110, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'CUSGRP' AND col_name = N'上级编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
    VALUES ('CUSGRP', N'上级编码', N'上级编码', N'文本', NULL, NULL, NULL, NULL, N'detail', 50, 140, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'CUSGRP' AND col_name = N'备注')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
    VALUES ('CUSGRP', N'备注', N'备注', N'文本', NULL, NULL, NULL, NULL, N'detail', 60, 240, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'CUSGRP' AND col_name = N'停用')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
    VALUES ('CUSGRP', N'停用', N'停用', N'是否', NULL, NULL, NULL, NULL, N'detail', 70, 80, 1, 0, 0, 1);
-- SUPGRP 供应商分类
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'SUPGRP' AND col_name = N'编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
    VALUES ('SUPGRP', N'编码', N'编码', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 10, 140, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'SUPGRP' AND col_name = N'名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
    VALUES ('SUPGRP', N'名称', N'名称', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 20, 180, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'SUPGRP' AND col_name = N'级次')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
    VALUES ('SUPGRP', N'级次', N'级次', N'文本', NULL, NULL, NULL, NULL, N'detail', 30, 70, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'SUPGRP' AND col_name = N'是否叶子节点')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
    VALUES ('SUPGRP', N'是否叶子节点', N'是否叶子节点', N'是否', NULL, NULL, NULL, NULL, N'detail', 40, 110, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'SUPGRP' AND col_name = N'上级编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
    VALUES ('SUPGRP', N'上级编码', N'上级编码', N'文本', NULL, NULL, NULL, NULL, N'detail', 50, 140, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'SUPGRP' AND col_name = N'停用')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
    VALUES ('SUPGRP', N'停用', N'停用', N'是否', NULL, NULL, NULL, NULL, N'detail', 60, 80, 1, 0, 0, 1);
-- MATGRP 商品分类
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'MATGRP' AND col_name = N'编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
    VALUES ('MATGRP', N'编码', N'编码', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 10, 140, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'MATGRP' AND col_name = N'名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
    VALUES ('MATGRP', N'名称', N'名称', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 20, 180, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'MATGRP' AND col_name = N'级次')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
    VALUES ('MATGRP', N'级次', N'级次', N'文本', NULL, NULL, NULL, NULL, N'detail', 30, 70, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'MATGRP' AND col_name = N'是否叶子节点')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
    VALUES ('MATGRP', N'是否叶子节点', N'是否叶子节点', N'是否', NULL, NULL, NULL, NULL, N'detail', 40, 110, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'MATGRP' AND col_name = N'上级编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
    VALUES ('MATGRP', N'上级编码', N'上级编码', N'文本', NULL, NULL, NULL, NULL, N'detail', 50, 140, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'MATGRP' AND col_name = N'停用')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
    VALUES ('MATGRP', N'停用', N'停用', N'是否', NULL, NULL, NULL, NULL, N'detail', 60, 80, 1, 0, 0, 1);
-- CUR 币别
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'CUR' AND col_name = N'编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
    VALUES ('CUR', N'编码', N'编码', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 10, 100, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'CUR' AND col_name = N'名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
    VALUES ('CUR', N'名称', N'名称', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 20, 120, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'CUR' AND col_name = N'币别符号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
    VALUES ('CUR', N'币别符号', N'币别符号', N'文本', NULL, NULL, NULL, NULL, N'detail', 30, 90, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'CUR' AND col_name = N'汇率')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
    VALUES ('CUR', N'汇率', N'汇率', N'小数', NULL, NULL, NULL, NULL, N'detail', 40, 90, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'CUR' AND col_name = N'汇率类型')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
    VALUES ('CUR', N'汇率类型', N'汇率类型', N'下拉框', N'SELECT v FROM (VALUES (N''固定汇率''),(N''浮动汇率'')) AS t(v)', NULL, NULL, NULL, N'detail', 50, 110, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'CUR' AND col_name = N'金额小数位')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
    VALUES ('CUR', N'金额小数位', N'金额小数位', N'整数', NULL, NULL, NULL, NULL, N'detail', 60, 100, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'CUR' AND col_name = N'单价小数位')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
    VALUES ('CUR', N'单价小数位', N'单价小数位', N'整数', NULL, NULL, NULL, NULL, N'detail', 70, 100, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'CUR' AND col_name = N'停用')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
    VALUES ('CUR', N'停用', N'停用', N'是否', NULL, NULL, NULL, NULL, N'detail', 80, 80, 1, 0, 0, 1);
GO

-- ══════════ 14. 在用 7 张档案目标表补同步锚点列(指引 §四.4 模板;仅物理列,不注册面板字段) ══════════
-- dm_kh 客户档案
IF COL_LENGTH('dbo.dm_kh', N'外部数据ID') IS NULL ALTER TABLE dbo.dm_kh ADD [外部数据ID] nvarchar(64) NULL;
IF COL_LENGTH('dbo.dm_kh', N'外部单据号') IS NULL ALTER TABLE dbo.dm_kh ADD [外部单据号] nvarchar(200) NULL;
IF COL_LENGTH('dbo.dm_kh', N'外部指纹') IS NULL ALTER TABLE dbo.dm_kh ADD [外部指纹] nvarchar(500) NULL;
-- dm_gf 供应商档案
IF COL_LENGTH('dbo.dm_gf', N'外部数据ID') IS NULL ALTER TABLE dbo.dm_gf ADD [外部数据ID] nvarchar(64) NULL;
IF COL_LENGTH('dbo.dm_gf', N'外部单据号') IS NULL ALTER TABLE dbo.dm_gf ADD [外部单据号] nvarchar(200) NULL;
IF COL_LENGTH('dbo.dm_gf', N'外部指纹') IS NULL ALTER TABLE dbo.dm_gf ADD [外部指纹] nvarchar(500) NULL;
-- bs_inv 存货
IF COL_LENGTH('dbo.bs_inv', N'外部数据ID') IS NULL ALTER TABLE dbo.bs_inv ADD [外部数据ID] nvarchar(64) NULL;
IF COL_LENGTH('dbo.bs_inv', N'外部单据号') IS NULL ALTER TABLE dbo.bs_inv ADD [外部单据号] nvarchar(200) NULL;
IF COL_LENGTH('dbo.bs_inv', N'外部指纹') IS NULL ALTER TABLE dbo.bs_inv ADD [外部指纹] nvarchar(500) NULL;
-- bs_emp 员工
IF COL_LENGTH('dbo.bs_emp', N'外部数据ID') IS NULL ALTER TABLE dbo.bs_emp ADD [外部数据ID] nvarchar(64) NULL;
IF COL_LENGTH('dbo.bs_emp', N'外部单据号') IS NULL ALTER TABLE dbo.bs_emp ADD [外部单据号] nvarchar(200) NULL;
IF COL_LENGTH('dbo.bs_emp', N'外部指纹') IS NULL ALTER TABLE dbo.bs_emp ADD [外部指纹] nvarchar(500) NULL;
-- bs_dept 部门
IF COL_LENGTH('dbo.bs_dept', N'外部数据ID') IS NULL ALTER TABLE dbo.bs_dept ADD [外部数据ID] nvarchar(64) NULL;
IF COL_LENGTH('dbo.bs_dept', N'外部单据号') IS NULL ALTER TABLE dbo.bs_dept ADD [外部单据号] nvarchar(200) NULL;
IF COL_LENGTH('dbo.bs_dept', N'外部指纹') IS NULL ALTER TABLE dbo.bs_dept ADD [外部指纹] nvarchar(500) NULL;
-- bs_wh 仓库
IF COL_LENGTH('dbo.bs_wh', N'外部数据ID') IS NULL ALTER TABLE dbo.bs_wh ADD [外部数据ID] nvarchar(64) NULL;
IF COL_LENGTH('dbo.bs_wh', N'外部单据号') IS NULL ALTER TABLE dbo.bs_wh ADD [外部单据号] nvarchar(200) NULL;
IF COL_LENGTH('dbo.bs_wh', N'外部指纹') IS NULL ALTER TABLE dbo.bs_wh ADD [外部指纹] nvarchar(500) NULL;
-- bs_uom 计量单位
IF COL_LENGTH('dbo.bs_uom', N'外部数据ID') IS NULL ALTER TABLE dbo.bs_uom ADD [外部数据ID] nvarchar(64) NULL;
IF COL_LENGTH('dbo.bs_uom', N'外部单据号') IS NULL ALTER TABLE dbo.bs_uom ADD [外部单据号] nvarchar(200) NULL;
IF COL_LENGTH('dbo.bs_uom', N'外部指纹') IS NULL ALTER TABLE dbo.bs_uom ADD [外部指纹] nvarchar(500) NULL;
GO
-- 唯一过滤索引(独立批次:同批次内新加列不可被后续语句引用)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ux_dm_kh_ext_id')
    CREATE UNIQUE INDEX ux_dm_kh_ext_id ON dbo.dm_kh([外部数据ID]) WHERE [外部数据ID] IS NOT NULL;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ux_dm_gf_ext_id')
    CREATE UNIQUE INDEX ux_dm_gf_ext_id ON dbo.dm_gf([外部数据ID]) WHERE [外部数据ID] IS NOT NULL;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ux_bs_inv_ext_id')
    CREATE UNIQUE INDEX ux_bs_inv_ext_id ON dbo.bs_inv([外部数据ID]) WHERE [外部数据ID] IS NOT NULL;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ux_bs_emp_ext_id')
    CREATE UNIQUE INDEX ux_bs_emp_ext_id ON dbo.bs_emp([外部数据ID]) WHERE [外部数据ID] IS NOT NULL;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ux_bs_dept_ext_id')
    CREATE UNIQUE INDEX ux_bs_dept_ext_id ON dbo.bs_dept([外部数据ID]) WHERE [外部数据ID] IS NOT NULL;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ux_bs_wh_ext_id')
    CREATE UNIQUE INDEX ux_bs_wh_ext_id ON dbo.bs_wh([外部数据ID]) WHERE [外部数据ID] IS NOT NULL;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ux_bs_uom_ext_id')
    CREATE UNIQUE INDEX ux_bs_uom_ext_id ON dbo.bs_uom([外部数据ID]) WHERE [外部数据ID] IS NOT NULL;
GO

-- 锚点列中文注明(改动已有表,鼓励补注)
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('dbo.dm_kh') AND minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.dm_kh'), N'外部数据ID', 'ColumnId') AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'金蝶星辰单据/档案 id(jdy-sync 幂等锚点)', N'SCHEMA', N'dbo', N'TABLE', N'dm_kh', N'COLUMN', N'外部数据ID';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('dbo.dm_gf') AND minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.dm_gf'), N'外部数据ID', 'ColumnId') AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'金蝶星辰单据/档案 id(jdy-sync 幂等锚点)', N'SCHEMA', N'dbo', N'TABLE', N'dm_gf', N'COLUMN', N'外部数据ID';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('dbo.bs_inv') AND minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.bs_inv'), N'外部数据ID', 'ColumnId') AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'金蝶星辰单据/档案 id(jdy-sync 幂等锚点)', N'SCHEMA', N'dbo', N'TABLE', N'bs_inv', N'COLUMN', N'外部数据ID';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('dbo.bs_emp') AND minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.bs_emp'), N'外部数据ID', 'ColumnId') AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'金蝶星辰单据/档案 id(jdy-sync 幂等锚点)', N'SCHEMA', N'dbo', N'TABLE', N'bs_emp', N'COLUMN', N'外部数据ID';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('dbo.bs_dept') AND minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.bs_dept'), N'外部数据ID', 'ColumnId') AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'金蝶星辰单据/档案 id(jdy-sync 幂等锚点)', N'SCHEMA', N'dbo', N'TABLE', N'bs_dept', N'COLUMN', N'外部数据ID';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('dbo.bs_wh') AND minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.bs_wh'), N'外部数据ID', 'ColumnId') AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'金蝶星辰单据/档案 id(jdy-sync 幂等锚点)', N'SCHEMA', N'dbo', N'TABLE', N'bs_wh', N'COLUMN', N'外部数据ID';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('dbo.bs_uom') AND minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.bs_uom'), N'外部数据ID', 'ColumnId') AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'金蝶星辰单据/档案 id(jdy-sync 幂等锚点)', N'SCHEMA', N'dbo', N'TABLE', N'bs_uom', N'COLUMN', N'外部数据ID';
GO

-- ══════════ 15. 多语言译名(9 语言;备注/汇率/名称/停用 已有全量译名免插) ══════════
MERGE yj_translation AS t USING (VALUES
-- 面板名(5 个新面板)
(N'panel', N'结算方式', N'en', N'Settlement Method'),
(N'panel', N'结算方式', N'ja', N'決済方法'),
(N'panel', N'结算方式', N'ko', N'결제 방식'),
(N'panel', N'结算方式', N'de', N'Zahlungsart'),
(N'panel', N'结算方式', N'es', N'Forma de liquidación'),
(N'panel', N'结算方式', N'fr', N'Mode de règlement'),
(N'panel', N'结算方式', N'ru', N'Способ расчёта'),
(N'panel', N'结算方式', N'th', N'วิธีชำระเงิน'),
(N'panel', N'结算方式', N'vi', N'Cách thanh toán'),
(N'panel', N'客户分类', N'en', N'Customer Group'),
(N'panel', N'客户分类', N'ja', N'顧客分類'),
(N'panel', N'客户分类', N'ko', N'고객 분류'),
(N'panel', N'客户分类', N'de', N'Kundengruppe'),
(N'panel', N'客户分类', N'es', N'Grupo de clientes'),
(N'panel', N'客户分类', N'fr', N'Groupe de clients'),
(N'panel', N'客户分类', N'ru', N'Группа клиентов'),
(N'panel', N'客户分类', N'th', N'กลุ่มลูกค้า'),
(N'panel', N'客户分类', N'vi', N'Nhóm khách hàng'),
(N'panel', N'供应商分类', N'en', N'Supplier Group'),
(N'panel', N'供应商分类', N'ja', N'仕入先分類'),
(N'panel', N'供应商分类', N'ko', N'공급업체 분류'),
(N'panel', N'供应商分类', N'de', N'Lieferantengruppe'),
(N'panel', N'供应商分类', N'es', N'Grupo de proveedores'),
(N'panel', N'供应商分类', N'fr', N'Groupe de fournisseurs'),
(N'panel', N'供应商分类', N'ru', N'Группа поставщиков'),
(N'panel', N'供应商分类', N'th', N'กลุ่มผู้ขาย'),
(N'panel', N'供应商分类', N'vi', N'Nhóm nhà cung cấp'),
(N'panel', N'商品分类', N'en', N'Material Group'),
(N'panel', N'商品分类', N'ja', N'商品分類'),
(N'panel', N'商品分类', N'ko', N'상품 분류'),
(N'panel', N'商品分类', N'de', N'Warengruppe'),
(N'panel', N'商品分类', N'es', N'Grupo de artículos'),
(N'panel', N'商品分类', N'fr', N'Groupe d''articles'),
(N'panel', N'商品分类', N'ru', N'Группа товаров'),
(N'panel', N'商品分类', N'th', N'กลุ่มสินค้า'),
(N'panel', N'商品分类', N'vi', N'Nhóm hàng hóa'),
(N'panel', N'币别', N'en', N'Currency'),
(N'panel', N'币别', N'ja', N'通貨'),
(N'panel', N'币别', N'ko', N'통화'),
(N'panel', N'币别', N'de', N'Währung'),
(N'panel', N'币别', N'es', N'Moneda'),
(N'panel', N'币别', N'fr', N'Devise'),
(N'panel', N'币别', N'ru', N'Валюта'),
(N'panel', N'币别', N'th', N'สกุลเงิน'),
(N'panel', N'币别', N'vi', N'Tiền tệ'),
-- 字段标签:改名产生
(N'field', N'详细地址', N'en', N'Detailed Address'),
(N'field', N'详细地址', N'ja', N'詳細住所'),
(N'field', N'详细地址', N'ko', N'상세 주소'),
(N'field', N'详细地址', N'de', N'Detailadresse'),
(N'field', N'详细地址', N'es', N'Dirección detallada'),
(N'field', N'详细地址', N'fr', N'Adresse détaillée'),
(N'field', N'详细地址', N'ru', N'Подробный адрес'),
(N'field', N'详细地址', N'th', N'ที่อยู่โดยละเอียด'),
(N'field', N'详细地址', N'vi', N'Địa chỉ chi tiết'),
(N'field', N'开户银行', N'en', N'Bank'),
(N'field', N'开户银行', N'ja', N'取引銀行'),
(N'field', N'开户银行', N'ko', N'거래 은행'),
(N'field', N'开户银行', N'de', N'Bank'),
(N'field', N'开户银行', N'es', N'Banco'),
(N'field', N'开户银行', N'fr', N'Banque'),
(N'field', N'开户银行', N'ru', N'Банк'),
(N'field', N'开户银行', N'th', N'ธนาคาร'),
(N'field', N'开户银行', N'vi', N'Ngân hàng'),
(N'field', N'开票税号', N'en', N'Tax Registration No.'),
(N'field', N'开票税号', N'ja', N'税登録番号'),
(N'field', N'开票税号', N'ko', N'세금 등록 번호'),
(N'field', N'开票税号', N'de', N'Steuernummer'),
(N'field', N'开票税号', N'es', N'N.º de identificación fiscal'),
(N'field', N'开票税号', N'fr', N'N° d''identification fiscale'),
(N'field', N'开票税号', N'ru', N'ИНН'),
(N'field', N'开票税号', N'th', N'เลขประจำตัวผู้เสียภาษี'),
(N'field', N'开票税号', N'vi', N'Mã số thuế'),
(N'field', N'价格等级', N'en', N'Price Level'),
(N'field', N'价格等级', N'ja', N'価格ランク'),
(N'field', N'价格等级', N'ko', N'가격 등급'),
(N'field', N'价格等级', N'de', N'Preisstufe'),
(N'field', N'价格等级', N'es', N'Nivel de precio'),
(N'field', N'价格等级', N'fr', N'Niveau de prix'),
(N'field', N'价格等级', N'ru', N'Ценовой уровень'),
(N'field', N'价格等级', N'th', N'ระดับราคา'),
(N'field', N'价格等级', N'vi', N'Cấp giá'),
(N'field', N'采购员', N'en', N'Purchaser'),
(N'field', N'采购员', N'ja', N'購買担当'),
(N'field', N'采购员', N'ko', N'구매 담당자'),
(N'field', N'采购员', N'de', N'Einkäufer'),
(N'field', N'采购员', N'es', N'Comprador'),
(N'field', N'采购员', N'fr', N'Acheteur'),
(N'field', N'采购员', N'ru', N'Закупщик'),
(N'field', N'采购员', N'th', N'ผู้จัดซื้อ'),
(N'field', N'采购员', N'vi', N'Người mua hàng'),
(N'field', N'数量小数位', N'en', N'Qty Decimal Places'),
(N'field', N'数量小数位', N'ja', N'数量小数桁'),
(N'field', N'数量小数位', N'ko', N'수량 소수 자릿수'),
(N'field', N'数量小数位', N'de', N'Dezimalstellen (Menge)'),
(N'field', N'数量小数位', N'es', N'Decimales de cantidad'),
(N'field', N'数量小数位', N'fr', N'Décimales de quantité'),
(N'field', N'数量小数位', N'ru', N'Разрядов после запятой (количество)'),
(N'field', N'数量小数位', N'th', N'ตำแหน่งทศนิยมของจำนวน'),
(N'field', N'数量小数位', N'vi', N'Số lẻ thập phân số lượng'),
-- 字段标签:新增(KHDA/GFDA/INV + 5 新面板)
(N'field', N'客户分类', N'en', N'Customer Group'),
(N'field', N'客户分类', N'ja', N'顧客分類'),
(N'field', N'客户分类', N'ko', N'고객 분류'),
(N'field', N'客户分类', N'de', N'Kundengruppe'),
(N'field', N'客户分类', N'es', N'Grupo de clientes'),
(N'field', N'客户分类', N'fr', N'Groupe de clients'),
(N'field', N'客户分类', N'ru', N'Группа клиентов'),
(N'field', N'客户分类', N'th', N'กลุ่มลูกค้า'),
(N'field', N'客户分类', N'vi', N'Nhóm khách hàng'),
(N'field', N'供应商分类', N'en', N'Supplier Group'),
(N'field', N'供应商分类', N'ja', N'仕入先分類'),
(N'field', N'供应商分类', N'ko', N'공급업체 분류'),
(N'field', N'供应商分类', N'de', N'Lieferantengruppe'),
(N'field', N'供应商分类', N'es', N'Grupo de proveedores'),
(N'field', N'供应商分类', N'fr', N'Groupe de fournisseurs'),
(N'field', N'供应商分类', N'ru', N'Группа поставщиков'),
(N'field', N'供应商分类', N'th', N'กลุ่มผู้ขาย'),
(N'field', N'供应商分类', N'vi', N'Nhóm nhà cung cấp'),
(N'field', N'条形码', N'en', N'Barcode'),
(N'field', N'条形码', N'ja', N'バーコード'),
(N'field', N'条形码', N'ko', N'바코드'),
(N'field', N'条形码', N'de', N'Strichcode'),
(N'field', N'条形码', N'es', N'Código de barras'),
(N'field', N'条形码', N'fr', N'Code-barres'),
(N'field', N'条形码', N'ru', N'Штрихкод'),
(N'field', N'条形码', N'th', N'บาร์โค้ด'),
(N'field', N'条形码', N'vi', N'Mã vạch'),
(N'field', N'编码', N'en', N'Code'),
(N'field', N'编码', N'ja', N'コード'),
(N'field', N'编码', N'ko', N'코드'),
(N'field', N'编码', N'de', N'Code'),
(N'field', N'编码', N'es', N'Código'),
(N'field', N'编码', N'fr', N'Code'),
(N'field', N'编码', N'ru', N'Код'),
(N'field', N'编码', N'th', N'รหัส'),
(N'field', N'编码', N'vi', N'Mã'),
(N'field', N'级次', N'en', N'Level'),
(N'field', N'级次', N'ja', N'階層'),
(N'field', N'级次', N'ko', N'레벨'),
(N'field', N'级次', N'de', N'Ebene'),
(N'field', N'级次', N'es', N'Nivel'),
(N'field', N'级次', N'fr', N'Niveau'),
(N'field', N'级次', N'ru', N'Уровень'),
(N'field', N'级次', N'th', N'ระดับ'),
(N'field', N'级次', N'vi', N'Cấp bậc'),
(N'field', N'是否叶子节点', N'en', N'Leaf Node'),
(N'field', N'是否叶子节点', N'ja', N'末端ノード'),
(N'field', N'是否叶子节点', N'ko', N'말단 노드'),
(N'field', N'是否叶子节点', N'de', N'Endknoten'),
(N'field', N'是否叶子节点', N'es', N'Nodo hoja'),
(N'field', N'是否叶子节点', N'fr', N'Nœud feuille'),
(N'field', N'是否叶子节点', N'ru', N'Конечный узел'),
(N'field', N'是否叶子节点', N'th', N'โหนดปลายทาง'),
(N'field', N'是否叶子节点', N'vi', N'Nút lá'),
(N'field', N'上级编码', N'en', N'Parent Code'),
(N'field', N'上级编码', N'ja', N'上位コード'),
(N'field', N'上级编码', N'ko', N'상위 코드'),
(N'field', N'上级编码', N'de', N'Übergeordneter Code'),
(N'field', N'上级编码', N'es', N'Código superior'),
(N'field', N'上级编码', N'fr', N'Code parent'),
(N'field', N'上级编码', N'ru', N'Код родителя'),
(N'field', N'上级编码', N'th', N'รหัสระดับบน'),
(N'field', N'上级编码', N'vi', N'Mã cấp trên'),
(N'field', N'是否默认', N'en', N'Default'),
(N'field', N'是否默认', N'ja', N'デフォルト'),
(N'field', N'是否默认', N'ko', N'기본'),
(N'field', N'是否默认', N'de', N'Standard'),
(N'field', N'是否默认', N'es', N'Predeterminado'),
(N'field', N'是否默认', N'fr', N'Par défaut'),
(N'field', N'是否默认', N'ru', N'По умолчанию'),
(N'field', N'是否默认', N'th', N'ค่าเริ่มต้น'),
(N'field', N'是否默认', N'vi', N'Mặc định'),
(N'field', N'币别符号', N'en', N'Currency Symbol'),
(N'field', N'币别符号', N'ja', N'通貨記号'),
(N'field', N'币别符号', N'ko', N'통화 기호'),
(N'field', N'币别符号', N'de', N'Währungssymbol'),
(N'field', N'币别符号', N'es', N'Símbolo de moneda'),
(N'field', N'币别符号', N'fr', N'Symbole de devise'),
(N'field', N'币别符号', N'ru', N'Символ валюты'),
(N'field', N'币别符号', N'th', N'สัญลักษณ์สกุลเงิน'),
(N'field', N'币别符号', N'vi', N'Ký hiệu tiền tệ'),
(N'field', N'汇率类型', N'en', N'Rate Type'),
(N'field', N'汇率类型', N'ja', N'為替タイプ'),
(N'field', N'汇率类型', N'ko', N'환율 유형'),
(N'field', N'汇率类型', N'de', N'Kurstyp'),
(N'field', N'汇率类型', N'es', N'Tipo de cambio'),
(N'field', N'汇率类型', N'fr', N'Type de taux'),
(N'field', N'汇率类型', N'ru', N'Тип курса'),
(N'field', N'汇率类型', N'th', N'ประเภทอัตราแลกเปลี่ยน'),
(N'field', N'汇率类型', N'vi', N'Loại tỷ giá'),
(N'field', N'金额小数位', N'en', N'Amount Decimals'),
(N'field', N'金额小数位', N'ja', N'金額小数桁'),
(N'field', N'金额小数位', N'ko', N'금액 소수 자릿수'),
(N'field', N'金额小数位', N'de', N'Dezimalstellen (Betrag)'),
(N'field', N'金额小数位', N'es', N'Decimales de importe'),
(N'field', N'金额小数位', N'fr', N'Décimales de montant'),
(N'field', N'金额小数位', N'ru', N'Разрядов после запятой (сумма)'),
(N'field', N'金额小数位', N'th', N'ตำแหน่งทศนิยมของจำนวนเงิน'),
(N'field', N'金额小数位', N'vi', N'Số lẻ thập phân tiền tệ'),
(N'field', N'单价小数位', N'en', N'Price Decimals'),
(N'field', N'单价小数位', N'ja', N'単価小数桁'),
(N'field', N'单价小数位', N'ko', N'단가 소수 자릿수'),
(N'field', N'单价小数位', N'de', N'Dezimalstellen (Preis)'),
(N'field', N'单价小数位', N'es', N'Decimales de precio'),
(N'field', N'单价小数位', N'fr', N'Décimales de prix'),
(N'field', N'单价小数位', N'ru', N'Разрядов после запятой (цена)'),
(N'field', N'单价小数位', N'th', N'ตำแหน่งทศนิยมของราคา'),
(N'field', N'单价小数位', N'vi', N'Số lẻ thập phân đơn giá')
) AS s(scope, ref_key, locale, text)
ON t.scope = s.scope AND t.ref_key = s.ref_key AND t.locale = s.locale
WHEN NOT MATCHED THEN INSERT (scope, ref_key, locale, text, source) VALUES (s.scope, s.ref_key, s.locale, s.text, 'manual');
GO

-- ══════════ 16. 自检(全部应为期望值,译名缺口应为 0) ══════════
SELECT N'KHDA' AS 面板, col_name + N'=' + label AS 对齐结果 FROM yj_field WHERE panel_code='KHDA' AND col_name IN ('dm','mc','khlb','khjb','addr','sui_no','bank','lxr') ORDER BY seq;
SELECT N'GFDA' AS 面板, col_name + N'=' + label AS 对齐结果 FROM yj_field WHERE panel_code='GFDA' AND col_name IN ('dm','mc','gysfl','ywman','sui_no','bank','ckadd') ORDER BY seq;
SELECT N'INV/UOM' AS 面板, col_name + N'=' + label AS 对齐结果 FROM yj_field WHERE (panel_code='INV' AND col_name IN (N'存货编码',N'存货名称',N'条形码',N'规格型号')) OR (panel_code='UOM' AND col_name=N'小数位数');
SELECT p.panel_code + N' ' + p.panel_name + N' → ' + p.line_table AS 新面板, COUNT(f.id) AS 字段数
FROM yj_panel p LEFT JOIN yj_field f ON f.panel_code = p.panel_code
WHERE p.panel_code IN ('SETTLE','CUSGRP','SUPGRP','MATGRP','CUR') GROUP BY p.panel_code, p.panel_name, p.line_table;
SELECT t.name AS 表,
  CASE WHEN COL_LENGTH(t.name,'外部数据ID') IS NOT NULL THEN 'Y' ELSE '-' END AS 锚点列,
  CASE WHEN INDEXPROPERTY(t.object_id, 'ux_' + t.name + '_ext_id', 'IndexId') IS NOT NULL THEN 'Y' ELSE '-' END AS 唯一索引
FROM sys.tables t WHERE t.name IN ('dm_kh','dm_gf','bs_inv','bs_emp','bs_dept','bs_wh','bs_uom','bs_settle_type','bs_customer_group','bs_supplier_group','bs_material_group','bs_currency') ORDER BY t.name;
SELECT s.ref_key + N'(' + s.scope + N')' AS 译名键, s.expected - ISNULL(t.n,0) AS 缺口 FROM (VALUES
(N'结算方式',N'panel',9),(N'客户分类',N'panel',9),(N'供应商分类',N'panel',9),(N'商品分类',N'panel',9),(N'币别',N'panel',9),
(N'客户分类',N'field',9),(N'供应商分类',N'field',9),(N'详细地址',N'field',9),(N'开户银行',N'field',9),(N'开票税号',N'field',9),
(N'价格等级',N'field',9),(N'采购员',N'field',9),(N'数量小数位',N'field',9),(N'条形码',N'field',9),(N'编码',N'field',9),
(N'级次',N'field',9),(N'是否叶子节点',N'field',9),(N'上级编码',N'field',9),(N'是否默认',N'field',9),(N'币别符号',N'field',9),
(N'汇率类型',N'field',9),(N'金额小数位',N'field',9),(N'单价小数位',N'field',9)) AS s(ref_key,scope,expected)
LEFT JOIN (SELECT ref_key, scope, COUNT(*) n FROM yj_translation WHERE locale IN ('en','ja','ko','de','es','fr','ru','th','vi') GROUP BY ref_key, scope) t
  ON t.ref_key = s.ref_key AND t.scope = s.scope;
PRINT N'migrate-kingdee-archive-align2 完成(基础档案字段对齐+5新面板+同步锚点)';
GO
