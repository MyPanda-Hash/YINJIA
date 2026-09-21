-- migrate-kingdee-archive-fields.sql — 基础资料档案按金蝶真实接口字段补齐(①档:接口返回且非敏感)
-- 生成器:tools/archive/_gen-archive-fields.mjs(规格即文档);依据:沙箱接口实测 deploy/_probe-archive-fields.mjs
-- 口径:敏感密文(bank_account/addr/tel/mobile/email/birthday/qq/wechat/证件号)不落;接口不提供的字段(客户洞察/标签/来源/禁用人)不做;
--      纯 id 字段(creator_id/storekeeper_id 等)不落(保留其名称/编码孪生字段)。
-- 幂等:列 COL_LENGTH 守卫 / yj_field IF NOT EXISTS / 译名 MERGE NOT MATCHED。
IF DB_NAME() = N'master' USE HSDZ_MES;   -- 仅在未选定库时切正式库(选定测试库/克隆库时不得被切走)
SET NOCOUNT ON;
GO

-- ══ bs_material_group(5 列)══
IF COL_LENGTH('dbo.bs_material_group', N'创建时间') IS NULL ALTER TABLE dbo.bs_material_group ADD [创建时间] datetime2 NULL;
IF COL_LENGTH('dbo.bs_material_group', N'修改时间') IS NULL ALTER TABLE dbo.bs_material_group ADD [修改时间] datetime2 NULL;
IF COL_LENGTH('dbo.bs_material_group', N'备注') IS NULL ALTER TABLE dbo.bs_material_group ADD [备注] nvarchar(500) NULL;
IF COL_LENGTH('dbo.bs_material_group', N'创建人') IS NULL ALTER TABLE dbo.bs_material_group ADD [创建人] nvarchar(100) NULL;
IF COL_LENGTH('dbo.bs_material_group', N'修改人') IS NULL ALTER TABLE dbo.bs_material_group ADD [修改人] nvarchar(100) NULL;
GO

-- ══ bs_currency(4 列)══
IF COL_LENGTH('dbo.bs_currency', N'创建人') IS NULL ALTER TABLE dbo.bs_currency ADD [创建人] nvarchar(100) NULL;
IF COL_LENGTH('dbo.bs_currency', N'创建时间') IS NULL ALTER TABLE dbo.bs_currency ADD [创建时间] datetime2 NULL;
IF COL_LENGTH('dbo.bs_currency', N'修改人') IS NULL ALTER TABLE dbo.bs_currency ADD [修改人] nvarchar(100) NULL;
IF COL_LENGTH('dbo.bs_currency', N'修改时间') IS NULL ALTER TABLE dbo.bs_currency ADD [修改时间] datetime2 NULL;
GO

-- ══ bs_uom(6 列)══
IF COL_LENGTH('dbo.bs_uom', N'长编码') IS NULL ALTER TABLE dbo.bs_uom ADD [长编码] nvarchar(100) NULL;
IF COL_LENGTH('dbo.bs_uom', N'精度处理') IS NULL ALTER TABLE dbo.bs_uom ADD [精度处理] int NULL;
IF COL_LENGTH('dbo.bs_uom', N'是否叶子节点') IS NULL ALTER TABLE dbo.bs_uom ADD [是否叶子节点] bit NULL;
IF COL_LENGTH('dbo.bs_uom', N'级次') IS NULL ALTER TABLE dbo.bs_uom ADD [级次] int NULL;
IF COL_LENGTH('dbo.bs_uom', N'创建时间') IS NULL ALTER TABLE dbo.bs_uom ADD [创建时间] datetime2 NULL;
IF COL_LENGTH('dbo.bs_uom', N'修改时间') IS NULL ALTER TABLE dbo.bs_uom ADD [修改时间] datetime2 NULL;
GO

-- ══ bs_dept(5 列)══
IF COL_LENGTH('dbo.bs_dept', N'级次') IS NULL ALTER TABLE dbo.bs_dept ADD [级次] nvarchar(20) NULL;
IF COL_LENGTH('dbo.bs_dept', N'长编码') IS NULL ALTER TABLE dbo.bs_dept ADD [长编码] nvarchar(100) NULL;
IF COL_LENGTH('dbo.bs_dept', N'部门全称') IS NULL ALTER TABLE dbo.bs_dept ADD [部门全称] nvarchar(200) NULL;
IF COL_LENGTH('dbo.bs_dept', N'上级编码') IS NULL ALTER TABLE dbo.bs_dept ADD [上级编码] nvarchar(100) NULL;
IF COL_LENGTH('dbo.bs_dept', N'是否叶子节点') IS NULL ALTER TABLE dbo.bs_dept ADD [是否叶子节点] bit NULL;
GO

-- ══ bs_emp(7 列)══
IF COL_LENGTH('dbo.bs_emp', N'性别') IS NULL ALTER TABLE dbo.bs_emp ADD [性别] nvarchar(10) NULL;
IF COL_LENGTH('dbo.bs_emp', N'部门编码') IS NULL ALTER TABLE dbo.bs_emp ADD [部门编码] nvarchar(100) NULL;
IF COL_LENGTH('dbo.bs_emp', N'入职日期') IS NULL ALTER TABLE dbo.bs_emp ADD [入职日期] nvarchar(30) NULL;
IF COL_LENGTH('dbo.bs_emp', N'离职日期') IS NULL ALTER TABLE dbo.bs_emp ADD [离职日期] nvarchar(30) NULL;
IF COL_LENGTH('dbo.bs_emp', N'邮箱') IS NULL ALTER TABLE dbo.bs_emp ADD [邮箱] nvarchar(200) NULL;
IF COL_LENGTH('dbo.bs_emp', N'生日') IS NULL ALTER TABLE dbo.bs_emp ADD [生日] nvarchar(50) NULL;
IF COL_LENGTH('dbo.bs_emp', N'微信') IS NULL ALTER TABLE dbo.bs_emp ADD [微信] nvarchar(100) NULL;
GO

-- ══ bs_wh(8 列)══
IF COL_LENGTH('dbo.bs_wh', N'仓库分类') IS NULL ALTER TABLE dbo.bs_wh ADD [仓库分类] nvarchar(200) NULL;
IF COL_LENGTH('dbo.bs_wh', N'仓库分类编码') IS NULL ALTER TABLE dbo.bs_wh ADD [仓库分类编码] nvarchar(100) NULL;
IF COL_LENGTH('dbo.bs_wh', N'国家') IS NULL ALTER TABLE dbo.bs_wh ADD [国家] nvarchar(100) NULL;
IF COL_LENGTH('dbo.bs_wh', N'省') IS NULL ALTER TABLE dbo.bs_wh ADD [省] nvarchar(100) NULL;
IF COL_LENGTH('dbo.bs_wh', N'市') IS NULL ALTER TABLE dbo.bs_wh ADD [市] nvarchar(100) NULL;
IF COL_LENGTH('dbo.bs_wh', N'区') IS NULL ALTER TABLE dbo.bs_wh ADD [区] nvarchar(100) NULL;
IF COL_LENGTH('dbo.bs_wh', N'启用仓位管理') IS NULL ALTER TABLE dbo.bs_wh ADD [启用仓位管理] bit NULL;
IF COL_LENGTH('dbo.bs_wh', N'仓库管理员编码') IS NULL ALTER TABLE dbo.bs_wh ADD [仓库管理员编码] nvarchar(100) NULL;
GO

-- ══ dm_gf(11 列)══
IF COL_LENGTH('dbo.dm_gf', N'供应商分类编码') IS NULL ALTER TABLE dbo.dm_gf ADD [供应商分类编码] nvarchar(100) NULL;
IF COL_LENGTH('dbo.dm_gf', N'增值税税率') IS NULL ALTER TABLE dbo.dm_gf ADD [增值税税率] decimal(18,4) NULL;
IF COL_LENGTH('dbo.dm_gf', N'开票名称') IS NULL ALTER TABLE dbo.dm_gf ADD [开票名称] nvarchar(200) NULL;
IF COL_LENGTH('dbo.dm_gf', N'开户地址') IS NULL ALTER TABLE dbo.dm_gf ADD [开户地址] nvarchar(200) NULL;
IF COL_LENGTH('dbo.dm_gf', N'采购员部门') IS NULL ALTER TABLE dbo.dm_gf ADD [采购员部门] nvarchar(200) NULL;
IF COL_LENGTH('dbo.dm_gf', N'自动抵扣预收款') IS NULL ALTER TABLE dbo.dm_gf ADD [自动抵扣预收款] bit NULL;
IF COL_LENGTH('dbo.dm_gf', N'联系人') IS NULL ALTER TABLE dbo.dm_gf ADD [联系人] nvarchar(200) NULL;
IF COL_LENGTH('dbo.dm_gf', N'供应商联系人手机') IS NULL ALTER TABLE dbo.dm_gf ADD [供应商联系人手机] nvarchar(100) NULL;
IF COL_LENGTH('dbo.dm_gf', N'供应商联系人座机') IS NULL ALTER TABLE dbo.dm_gf ADD [供应商联系人座机] nvarchar(100) NULL;
IF COL_LENGTH('dbo.dm_gf', N'供应商联系人邮箱') IS NULL ALTER TABLE dbo.dm_gf ADD [供应商联系人邮箱] nvarchar(200) NULL;
IF COL_LENGTH('dbo.dm_gf', N'供应商联系人地址') IS NULL ALTER TABLE dbo.dm_gf ADD [供应商联系人地址] nvarchar(500) NULL;
GO

-- ══ bs_inv(63 列)══
IF COL_LENGTH('dbo.bs_inv', N'备注') IS NULL ALTER TABLE dbo.bs_inv ADD [备注] nvarchar(500) NULL;
IF COL_LENGTH('dbo.bs_inv', N'助记码') IS NULL ALTER TABLE dbo.bs_inv ADD [助记码] nvarchar(100) NULL;
IF COL_LENGTH('dbo.bs_inv', N'产地') IS NULL ALTER TABLE dbo.bs_inv ADD [产地] nvarchar(200) NULL;
IF COL_LENGTH('dbo.bs_inv', N'商品类型') IS NULL ALTER TABLE dbo.bs_inv ADD [商品类型] nvarchar(20) NULL;
IF COL_LENGTH('dbo.bs_inv', N'是否可销售') IS NULL ALTER TABLE dbo.bs_inv ADD [是否可销售] bit NULL;
IF COL_LENGTH('dbo.bs_inv', N'是否可采购') IS NULL ALTER TABLE dbo.bs_inv ADD [是否可采购] bit NULL;
IF COL_LENGTH('dbo.bs_inv', N'是否为子件') IS NULL ALTER TABLE dbo.bs_inv ADD [是否为子件] bit NULL;
IF COL_LENGTH('dbo.bs_inv', N'是否为组件') IS NULL ALTER TABLE dbo.bs_inv ADD [是否为组件] bit NULL;
IF COL_LENGTH('dbo.bs_inv', N'是否多单位') IS NULL ALTER TABLE dbo.bs_inv ADD [是否多单位] bit NULL;
IF COL_LENGTH('dbo.bs_inv', N'辅助单位') IS NULL ALTER TABLE dbo.bs_inv ADD [辅助单位] nvarchar(100) NULL;
IF COL_LENGTH('dbo.bs_inv', N'辅助单位编码') IS NULL ALTER TABLE dbo.bs_inv ADD [辅助单位编码] nvarchar(100) NULL;
IF COL_LENGTH('dbo.bs_inv', N'是否启用保质期') IS NULL ALTER TABLE dbo.bs_inv ADD [是否启用保质期] bit NULL;
IF COL_LENGTH('dbo.bs_inv', N'保质期') IS NULL ALTER TABLE dbo.bs_inv ADD [保质期] decimal(18,4) NULL;
IF COL_LENGTH('dbo.bs_inv', N'保质期单位') IS NULL ALTER TABLE dbo.bs_inv ADD [保质期单位] nvarchar(10) NULL;
IF COL_LENGTH('dbo.bs_inv', N'预警天数') IS NULL ALTER TABLE dbo.bs_inv ADD [预警天数] decimal(18,4) NULL;
IF COL_LENGTH('dbo.bs_inv', N'是否启用辅助属性') IS NULL ALTER TABLE dbo.bs_inv ADD [是否启用辅助属性] bit NULL;
IF COL_LENGTH('dbo.bs_inv', N'库存管理方式') IS NULL ALTER TABLE dbo.bs_inv ADD [库存管理方式] nvarchar(20) NULL;
IF COL_LENGTH('dbo.bs_inv', N'最低库存') IS NULL ALTER TABLE dbo.bs_inv ADD [最低库存] decimal(18,4) NULL;
IF COL_LENGTH('dbo.bs_inv', N'最高库存') IS NULL ALTER TABLE dbo.bs_inv ADD [最高库存] decimal(18,4) NULL;
IF COL_LENGTH('dbo.bs_inv', N'预警库存') IS NULL ALTER TABLE dbo.bs_inv ADD [预警库存] decimal(18,4) NULL;
IF COL_LENGTH('dbo.bs_inv', N'销项税率') IS NULL ALTER TABLE dbo.bs_inv ADD [销项税率] decimal(18,4) NULL;
IF COL_LENGTH('dbo.bs_inv', N'进项税率') IS NULL ALTER TABLE dbo.bs_inv ADD [进项税率] decimal(18,4) NULL;
IF COL_LENGTH('dbo.bs_inv', N'生产许可证') IS NULL ALTER TABLE dbo.bs_inv ADD [生产许可证] nvarchar(200) NULL;
IF COL_LENGTH('dbo.bs_inv', N'注册证号') IS NULL ALTER TABLE dbo.bs_inv ADD [注册证号] nvarchar(200) NULL;
IF COL_LENGTH('dbo.bs_inv', N'毛重') IS NULL ALTER TABLE dbo.bs_inv ADD [毛重] decimal(18,4) NULL;
IF COL_LENGTH('dbo.bs_inv', N'净重') IS NULL ALTER TABLE dbo.bs_inv ADD [净重] decimal(18,4) NULL;
IF COL_LENGTH('dbo.bs_inv', N'长') IS NULL ALTER TABLE dbo.bs_inv ADD [长] decimal(18,4) NULL;
IF COL_LENGTH('dbo.bs_inv', N'宽') IS NULL ALTER TABLE dbo.bs_inv ADD [宽] decimal(18,4) NULL;
IF COL_LENGTH('dbo.bs_inv', N'高') IS NULL ALTER TABLE dbo.bs_inv ADD [高] decimal(18,4) NULL;
IF COL_LENGTH('dbo.bs_inv', N'体积') IS NULL ALTER TABLE dbo.bs_inv ADD [体积] decimal(18,4) NULL;
IF COL_LENGTH('dbo.bs_inv', N'可用库存') IS NULL ALTER TABLE dbo.bs_inv ADD [可用库存] decimal(18,4) NULL;
IF COL_LENGTH('dbo.bs_inv', N'即时库存') IS NULL ALTER TABLE dbo.bs_inv ADD [即时库存] decimal(18,4) NULL;
IF COL_LENGTH('dbo.bs_inv', N'最小包装量') IS NULL ALTER TABLE dbo.bs_inv ADD [最小包装量] decimal(18,4) NULL;
IF COL_LENGTH('dbo.bs_inv', N'默认生产车间编码') IS NULL ALTER TABLE dbo.bs_inv ADD [默认生产车间编码] nvarchar(100) NULL;
IF COL_LENGTH('dbo.bs_inv', N'是否倒冲领料') IS NULL ALTER TABLE dbo.bs_inv ADD [是否倒冲领料] bit NULL;
IF COL_LENGTH('dbo.bs_inv', N'倒冲仓库名称') IS NULL ALTER TABLE dbo.bs_inv ADD [倒冲仓库名称] nvarchar(200) NULL;
IF COL_LENGTH('dbo.bs_inv', N'倒冲仓库编码') IS NULL ALTER TABLE dbo.bs_inv ADD [倒冲仓库编码] nvarchar(100) NULL;
IF COL_LENGTH('dbo.bs_inv', N'倒冲仓位名称') IS NULL ALTER TABLE dbo.bs_inv ADD [倒冲仓位名称] nvarchar(200) NULL;
IF COL_LENGTH('dbo.bs_inv', N'商品标签') IS NULL ALTER TABLE dbo.bs_inv ADD [商品标签] nvarchar(500) NULL;
IF COL_LENGTH('dbo.bs_inv', N'品牌编码') IS NULL ALTER TABLE dbo.bs_inv ADD [品牌编码] nvarchar(100) NULL;
IF COL_LENGTH('dbo.bs_inv', N'默认仓库') IS NULL ALTER TABLE dbo.bs_inv ADD [默认仓库] nvarchar(200) NULL;
IF COL_LENGTH('dbo.bs_inv', N'默认仓库编码') IS NULL ALTER TABLE dbo.bs_inv ADD [默认仓库编码] nvarchar(100) NULL;
IF COL_LENGTH('dbo.bs_inv', N'基本单位编码') IS NULL ALTER TABLE dbo.bs_inv ADD [基本单位编码] nvarchar(100) NULL;
IF COL_LENGTH('dbo.bs_inv', N'是否自制') IS NULL ALTER TABLE dbo.bs_inv ADD [是否自制] bit NULL;
IF COL_LENGTH('dbo.bs_inv', N'是否启用称重') IS NULL ALTER TABLE dbo.bs_inv ADD [是否启用称重] bit NULL;
IF COL_LENGTH('dbo.bs_inv', N'是否序列号管理') IS NULL ALTER TABLE dbo.bs_inv ADD [是否序列号管理] bit NULL;
IF COL_LENGTH('dbo.bs_inv', N'是否批次管理') IS NULL ALTER TABLE dbo.bs_inv ADD [是否批次管理] bit NULL;
IF COL_LENGTH('dbo.bs_inv', N'多单位') IS NULL ALTER TABLE dbo.bs_inv ADD [多单位] nvarchar(500) NULL;
IF COL_LENGTH('dbo.bs_inv', N'图片链接') IS NULL ALTER TABLE dbo.bs_inv ADD [图片链接] nvarchar(500) NULL;
IF COL_LENGTH('dbo.bs_inv', N'采购价') IS NULL ALTER TABLE dbo.bs_inv ADD [采购价] decimal(18,4) NULL;
IF COL_LENGTH('dbo.bs_inv', N'零售价') IS NULL ALTER TABLE dbo.bs_inv ADD [零售价] decimal(18,4) NULL;
IF COL_LENGTH('dbo.bs_inv', N'批发价') IS NULL ALTER TABLE dbo.bs_inv ADD [批发价] decimal(18,4) NULL;
IF COL_LENGTH('dbo.bs_inv', N'配送价') IS NULL ALTER TABLE dbo.bs_inv ADD [配送价] decimal(18,4) NULL;
IF COL_LENGTH('dbo.bs_inv', N'最低销售价') IS NULL ALTER TABLE dbo.bs_inv ADD [最低销售价] decimal(18,4) NULL;
IF COL_LENGTH('dbo.bs_inv', N'最高采购价') IS NULL ALTER TABLE dbo.bs_inv ADD [最高采购价] decimal(18,4) NULL;
IF COL_LENGTH('dbo.bs_inv', N'最近采购价') IS NULL ALTER TABLE dbo.bs_inv ADD [最近采购价] decimal(18,4) NULL;
IF COL_LENGTH('dbo.bs_inv', N'最近销售价') IS NULL ALTER TABLE dbo.bs_inv ADD [最近销售价] decimal(18,4) NULL;
IF COL_LENGTH('dbo.bs_inv', N'最近含税采购价') IS NULL ALTER TABLE dbo.bs_inv ADD [最近含税采购价] decimal(18,4) NULL;
IF COL_LENGTH('dbo.bs_inv', N'最近含税销售价') IS NULL ALTER TABLE dbo.bs_inv ADD [最近含税销售价] decimal(18,4) NULL;
IF COL_LENGTH('dbo.bs_inv', N'最近采购入库成本') IS NULL ALTER TABLE dbo.bs_inv ADD [最近采购入库成本] decimal(18,4) NULL;
IF COL_LENGTH('dbo.bs_inv', N'最近成交供应商') IS NULL ALTER TABLE dbo.bs_inv ADD [最近成交供应商] nvarchar(200) NULL;
IF COL_LENGTH('dbo.bs_inv', N'委外价') IS NULL ALTER TABLE dbo.bs_inv ADD [委外价] decimal(18,4) NULL;
IF COL_LENGTH('dbo.bs_inv', N'价格单位') IS NULL ALTER TABLE dbo.bs_inv ADD [价格单位] nvarchar(100) NULL;
GO

-- ══ dm_kh(33 列)══
IF COL_LENGTH('dbo.dm_kh', N'客户分类编码') IS NULL ALTER TABLE dbo.dm_kh ADD [客户分类编码] nvarchar(100) NULL;
IF COL_LENGTH('dbo.dm_kh', N'价格等级编码') IS NULL ALTER TABLE dbo.dm_kh ADD [价格等级编码] nvarchar(100) NULL;
IF COL_LENGTH('dbo.dm_kh', N'业务员编码') IS NULL ALTER TABLE dbo.dm_kh ADD [业务员编码] nvarchar(100) NULL;
IF COL_LENGTH('dbo.dm_kh', N'结算客户') IS NULL ALTER TABLE dbo.dm_kh ADD [结算客户] nvarchar(200) NULL;
IF COL_LENGTH('dbo.dm_kh', N'结算客户编码') IS NULL ALTER TABLE dbo.dm_kh ADD [结算客户编码] nvarchar(100) NULL;
IF COL_LENGTH('dbo.dm_kh', N'部门') IS NULL ALTER TABLE dbo.dm_kh ADD [部门] nvarchar(200) NULL;
IF COL_LENGTH('dbo.dm_kh', N'部门编码') IS NULL ALTER TABLE dbo.dm_kh ADD [部门编码] nvarchar(100) NULL;
IF COL_LENGTH('dbo.dm_kh', N'增值税税率') IS NULL ALTER TABLE dbo.dm_kh ADD [增值税税率] decimal(18,4) NULL;
IF COL_LENGTH('dbo.dm_kh', N'开票名称') IS NULL ALTER TABLE dbo.dm_kh ADD [开票名称] nvarchar(200) NULL;
IF COL_LENGTH('dbo.dm_kh', N'发票类型') IS NULL ALTER TABLE dbo.dm_kh ADD [发票类型] nvarchar(20) NULL;
IF COL_LENGTH('dbo.dm_kh', N'国家编码') IS NULL ALTER TABLE dbo.dm_kh ADD [国家编码] nvarchar(50) NULL;
IF COL_LENGTH('dbo.dm_kh', N'省份编码') IS NULL ALTER TABLE dbo.dm_kh ADD [省份编码] nvarchar(50) NULL;
IF COL_LENGTH('dbo.dm_kh', N'城市编码') IS NULL ALTER TABLE dbo.dm_kh ADD [城市编码] nvarchar(50) NULL;
IF COL_LENGTH('dbo.dm_kh', N'区县编码') IS NULL ALTER TABLE dbo.dm_kh ADD [区县编码] nvarchar(50) NULL;
IF COL_LENGTH('dbo.dm_kh', N'结算期限') IS NULL ALTER TABLE dbo.dm_kh ADD [结算期限] nvarchar(100) NULL;
IF COL_LENGTH('dbo.dm_kh', N'结算期限编码') IS NULL ALTER TABLE dbo.dm_kh ADD [结算期限编码] nvarchar(100) NULL;
IF COL_LENGTH('dbo.dm_kh', N'自动抵扣预收款') IS NULL ALTER TABLE dbo.dm_kh ADD [自动抵扣预收款] bit NULL;
IF COL_LENGTH('dbo.dm_kh', N'信用额度') IS NULL ALTER TABLE dbo.dm_kh ADD [信用额度] decimal(18,4) NULL;
IF COL_LENGTH('dbo.dm_kh', N'创建人') IS NULL ALTER TABLE dbo.dm_kh ADD [创建人] nvarchar(100) NULL;
IF COL_LENGTH('dbo.dm_kh', N'创建时间') IS NULL ALTER TABLE dbo.dm_kh ADD [创建时间] datetime2 NULL;
IF COL_LENGTH('dbo.dm_kh', N'修改时间') IS NULL ALTER TABLE dbo.dm_kh ADD [修改时间] datetime2 NULL;
IF COL_LENGTH('dbo.dm_kh', N'收票邮箱') IS NULL ALTER TABLE dbo.dm_kh ADD [收票邮箱] nvarchar(200) NULL;
IF COL_LENGTH('dbo.dm_kh', N'收票手机号') IS NULL ALTER TABLE dbo.dm_kh ADD [收票手机号] nvarchar(100) NULL;
IF COL_LENGTH('dbo.dm_kh', N'开户地址') IS NULL ALTER TABLE dbo.dm_kh ADD [开户地址] nvarchar(200) NULL;
IF COL_LENGTH('dbo.dm_kh', N'联系人性别') IS NULL ALTER TABLE dbo.dm_kh ADD [联系人性别] nvarchar(10) NULL;
IF COL_LENGTH('dbo.dm_kh', N'首要联系人') IS NULL ALTER TABLE dbo.dm_kh ADD [首要联系人] bit NULL;
IF COL_LENGTH('dbo.dm_kh', N'联系人手机') IS NULL ALTER TABLE dbo.dm_kh ADD [联系人手机] nvarchar(100) NULL;
IF COL_LENGTH('dbo.dm_kh', N'联系人座机') IS NULL ALTER TABLE dbo.dm_kh ADD [联系人座机] nvarchar(100) NULL;
IF COL_LENGTH('dbo.dm_kh', N'联系人邮箱') IS NULL ALTER TABLE dbo.dm_kh ADD [联系人邮箱] nvarchar(200) NULL;
IF COL_LENGTH('dbo.dm_kh', N'联系人生日') IS NULL ALTER TABLE dbo.dm_kh ADD [联系人生日] nvarchar(50) NULL;
IF COL_LENGTH('dbo.dm_kh', N'联系人QQ') IS NULL ALTER TABLE dbo.dm_kh ADD [联系人QQ] nvarchar(50) NULL;
IF COL_LENGTH('dbo.dm_kh', N'联系人微信') IS NULL ALTER TABLE dbo.dm_kh ADD [联系人微信] nvarchar(100) NULL;
IF COL_LENGTH('dbo.dm_kh', N'联系人地址') IS NULL ALTER TABLE dbo.dm_kh ADD [联系人地址] nvarchar(500) NULL;
GO

-- ══ yj_field 注册(面板可见;seq 900 段)══
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATGRP' AND col_name=N'创建时间')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATGRP', N'创建时间', N'创建时间', N'日期', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATGRP' AND col_name=N'修改时间')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATGRP', N'修改时间', N'修改时间', N'日期', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATGRP' AND col_name=N'备注')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATGRP', N'备注', N'备注', N'文本', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATGRP' AND col_name=N'创建人')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATGRP', N'创建人', N'创建人', N'文本', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATGRP' AND col_name=N'修改人')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATGRP', N'修改人', N'修改人', N'文本', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='CUR' AND col_name=N'创建人')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('CUR', N'创建人', N'创建人', N'文本', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='CUR' AND col_name=N'创建时间')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('CUR', N'创建时间', N'创建时间', N'日期', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='CUR' AND col_name=N'修改人')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('CUR', N'修改人', N'修改人', N'文本', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='CUR' AND col_name=N'修改时间')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('CUR', N'修改时间', N'修改时间', N'日期', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='UOM' AND col_name=N'长编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('UOM', N'长编码', N'长编码', N'文本', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='UOM' AND col_name=N'精度处理')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('UOM', N'精度处理', N'精度处理', N'整数', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='UOM' AND col_name=N'是否叶子节点')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('UOM', N'是否叶子节点', N'是否叶子节点', N'是否', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='UOM' AND col_name=N'级次')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('UOM', N'级次', N'级次', N'整数', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='UOM' AND col_name=N'创建时间')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('UOM', N'创建时间', N'创建时间', N'日期', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='UOM' AND col_name=N'修改时间')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('UOM', N'修改时间', N'修改时间', N'日期', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='DEPT' AND col_name=N'级次')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('DEPT', N'级次', N'级次', N'文本', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='DEPT' AND col_name=N'长编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('DEPT', N'长编码', N'长编码', N'文本', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='DEPT' AND col_name=N'部门全称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('DEPT', N'部门全称', N'部门全称', N'文本', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='DEPT' AND col_name=N'上级编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('DEPT', N'上级编码', N'上级编码', N'文本', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='DEPT' AND col_name=N'是否叶子节点')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('DEPT', N'是否叶子节点', N'是否叶子节点', N'是否', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='EMP' AND col_name=N'性别')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('EMP', N'性别', N'性别', N'文本', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='EMP' AND col_name=N'部门编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('EMP', N'部门编码', N'部门编码', N'文本', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='EMP' AND col_name=N'入职日期')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('EMP', N'入职日期', N'入职日期', N'文本', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='EMP' AND col_name=N'离职日期')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('EMP', N'离职日期', N'离职日期', N'文本', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WH' AND col_name=N'仓库分类')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('WH', N'仓库分类', N'仓库分类', N'文本', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WH' AND col_name=N'仓库分类编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('WH', N'仓库分类编码', N'仓库分类编码', N'文本', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WH' AND col_name=N'国家')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('WH', N'国家', N'国家', N'文本', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WH' AND col_name=N'省')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('WH', N'省', N'省', N'文本', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WH' AND col_name=N'市')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('WH', N'市', N'市', N'文本', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WH' AND col_name=N'区')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('WH', N'区', N'区', N'文本', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WH' AND col_name=N'启用仓位管理')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('WH', N'启用仓位管理', N'启用仓位管理', N'是否', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WH' AND col_name=N'仓库管理员编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('WH', N'仓库管理员编码', N'仓库管理员编码', N'文本', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='GFDA' AND col_name=N'供应商分类编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('GFDA', N'供应商分类编码', N'供应商分类编码', N'文本', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='GFDA' AND col_name=N'增值税税率')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('GFDA', N'增值税税率', N'增值税税率', N'小数', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='GFDA' AND col_name=N'开票名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('GFDA', N'开票名称', N'开票名称', N'文本', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='GFDA' AND col_name=N'开户地址')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('GFDA', N'开户地址', N'开户地址', N'文本', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='GFDA' AND col_name=N'采购员部门')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('GFDA', N'采购员部门', N'采购员部门', N'文本', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='GFDA' AND col_name=N'自动抵扣预收款')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('GFDA', N'自动抵扣预收款', N'自动抵扣预收款', N'是否', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'备注')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'备注', N'备注', N'文本', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'助记码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'助记码', N'助记码', N'文本', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'产地')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'产地', N'产地', N'文本', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'商品类型')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'商品类型', N'商品类型', N'文本', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'是否可销售')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'是否可销售', N'是否可销售', N'是否', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'是否可采购')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'是否可采购', N'是否可采购', N'是否', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'是否为子件')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'是否为子件', N'是否为子件', N'是否', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'是否为组件')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'是否为组件', N'是否为组件', N'是否', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'是否多单位')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'是否多单位', N'是否多单位', N'是否', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'辅助单位')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'辅助单位', N'辅助单位', N'文本', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'辅助单位编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'辅助单位编码', N'辅助单位编码', N'文本', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'是否启用保质期')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'是否启用保质期', N'是否启用保质期', N'是否', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'保质期')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'保质期', N'保质期', N'小数', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'保质期单位')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'保质期单位', N'保质期单位', N'文本', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'预警天数')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'预警天数', N'预警天数', N'小数', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'是否启用辅助属性')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'是否启用辅助属性', N'是否启用辅助属性', N'是否', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'库存管理方式')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'库存管理方式', N'库存管理方式', N'文本', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'最低库存')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'最低库存', N'最低库存', N'小数', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'最高库存')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'最高库存', N'最高库存', N'小数', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'预警库存')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'预警库存', N'预警库存', N'小数', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'销项税率')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'销项税率', N'销项税率', N'小数', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'进项税率')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'进项税率', N'进项税率', N'小数', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'生产许可证')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'生产许可证', N'生产许可证', N'文本', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'注册证号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'注册证号', N'注册证号', N'文本', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'毛重')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'毛重', N'毛重', N'小数', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'净重')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'净重', N'净重', N'小数', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'长')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'长', N'长', N'小数', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'宽')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'宽', N'宽', N'小数', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'高')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'高', N'高', N'小数', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'体积')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'体积', N'体积', N'小数', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'可用库存')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'可用库存', N'可用库存', N'小数', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'即时库存')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'即时库存', N'即时库存', N'小数', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'最小包装量')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'最小包装量', N'最小包装量', N'小数', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'默认生产车间编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'默认生产车间编码', N'默认生产车间编码', N'文本', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'是否倒冲领料')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'是否倒冲领料', N'是否倒冲领料', N'是否', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'倒冲仓库名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'倒冲仓库名称', N'倒冲仓库名称', N'文本', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'倒冲仓库编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'倒冲仓库编码', N'倒冲仓库编码', N'文本', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'倒冲仓位名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'倒冲仓位名称', N'倒冲仓位名称', N'文本', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'商品标签')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'商品标签', N'商品标签', N'文本', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'品牌编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'品牌编码', N'品牌编码', N'文本', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'默认仓库')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'默认仓库', N'默认仓库', N'文本', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'默认仓库编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'默认仓库编码', N'默认仓库编码', N'文本', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'基本单位编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'基本单位编码', N'基本单位编码', N'文本', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'是否自制')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'是否自制', N'是否自制', N'是否', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'是否启用称重')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'是否启用称重', N'是否启用称重', N'是否', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'是否序列号管理')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'是否序列号管理', N'是否序列号管理', N'是否', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'是否批次管理')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'是否批次管理', N'是否批次管理', N'是否', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'多单位')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'多单位', N'多单位', N'文本', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'图片链接')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'图片链接', N'图片链接', N'文本', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'采购价')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'采购价', N'采购价', N'小数', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'零售价')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'零售价', N'零售价', N'小数', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'批发价')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'批发价', N'批发价', N'小数', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'配送价')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'配送价', N'配送价', N'小数', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'最低销售价')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'最低销售价', N'最低销售价', N'小数', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'最高采购价')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'最高采购价', N'最高采购价', N'小数', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'最近采购价')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'最近采购价', N'最近采购价', N'小数', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'最近销售价')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'最近销售价', N'最近销售价', N'小数', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'最近含税采购价')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'最近含税采购价', N'最近含税采购价', N'小数', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'最近含税销售价')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'最近含税销售价', N'最近含税销售价', N'小数', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'最近采购入库成本')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'最近采购入库成本', N'最近采购入库成本', N'小数', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'最近成交供应商')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'最近成交供应商', N'最近成交供应商', N'文本', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'委外价')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'委外价', N'委外价', N'小数', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'价格单位')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'价格单位', N'价格单位', N'文本', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='KHDA' AND col_name=N'客户分类编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('KHDA', N'客户分类编码', N'客户分类编码', N'文本', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='KHDA' AND col_name=N'价格等级编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('KHDA', N'价格等级编码', N'价格等级编码', N'文本', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='KHDA' AND col_name=N'业务员编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('KHDA', N'业务员编码', N'业务员编码', N'文本', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='KHDA' AND col_name=N'结算客户')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('KHDA', N'结算客户', N'结算客户', N'文本', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='KHDA' AND col_name=N'结算客户编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('KHDA', N'结算客户编码', N'结算客户编码', N'文本', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='KHDA' AND col_name=N'部门')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('KHDA', N'部门', N'部门', N'文本', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='KHDA' AND col_name=N'部门编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('KHDA', N'部门编码', N'部门编码', N'文本', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='KHDA' AND col_name=N'增值税税率')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('KHDA', N'增值税税率', N'增值税税率', N'小数', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='KHDA' AND col_name=N'开票名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('KHDA', N'开票名称', N'开票名称', N'文本', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='KHDA' AND col_name=N'发票类型')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('KHDA', N'发票类型', N'发票类型', N'文本', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='KHDA' AND col_name=N'国家编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('KHDA', N'国家编码', N'国家编码', N'文本', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='KHDA' AND col_name=N'省份编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('KHDA', N'省份编码', N'省份编码', N'文本', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='KHDA' AND col_name=N'城市编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('KHDA', N'城市编码', N'城市编码', N'文本', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='KHDA' AND col_name=N'区县编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('KHDA', N'区县编码', N'区县编码', N'文本', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='KHDA' AND col_name=N'结算期限')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('KHDA', N'结算期限', N'结算期限', N'文本', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='KHDA' AND col_name=N'结算期限编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('KHDA', N'结算期限编码', N'结算期限编码', N'文本', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='KHDA' AND col_name=N'自动抵扣预收款')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('KHDA', N'自动抵扣预收款', N'自动抵扣预收款', N'是否', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='KHDA' AND col_name=N'信用额度')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('KHDA', N'信用额度', N'信用额度', N'小数', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='KHDA' AND col_name=N'创建人')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('KHDA', N'创建人', N'创建人', N'文本', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='KHDA' AND col_name=N'创建时间')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('KHDA', N'创建时间', N'创建时间', N'日期', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='KHDA' AND col_name=N'修改时间')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('KHDA', N'修改时间', N'修改时间', N'日期', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='KHDA' AND col_name=N'收票邮箱')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('KHDA', N'收票邮箱', N'收票邮箱', N'文本', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='KHDA' AND col_name=N'收票手机号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('KHDA', N'收票手机号', N'收票手机号', N'文本', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='KHDA' AND col_name=N'开户地址')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('KHDA', N'开户地址', N'开户地址', N'文本', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='KHDA' AND col_name=N'联系人性别')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('KHDA', N'联系人性别', N'联系人性别', N'文本', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='KHDA' AND col_name=N'首要联系人')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('KHDA', N'首要联系人', N'首要联系人', N'是否', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='KHDA' AND col_name=N'联系人手机')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('KHDA', N'联系人手机', N'联系人手机', N'文本', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='KHDA' AND col_name=N'联系人座机')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('KHDA', N'联系人座机', N'联系人座机', N'文本', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='KHDA' AND col_name=N'联系人邮箱')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('KHDA', N'联系人邮箱', N'联系人邮箱', N'文本', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='KHDA' AND col_name=N'联系人生日')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('KHDA', N'联系人生日', N'联系人生日', N'文本', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='KHDA' AND col_name=N'联系人QQ')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('KHDA', N'联系人QQ', N'联系人QQ', N'文本', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='KHDA' AND col_name=N'联系人微信')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('KHDA', N'联系人微信', N'联系人微信', N'文本', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='KHDA' AND col_name=N'联系人地址')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('KHDA', N'联系人地址', N'联系人地址', N'文本', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='GFDA' AND col_name=N'联系人')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('GFDA', N'联系人', N'联系人', N'文本', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='GFDA' AND col_name=N'供应商联系人手机')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('GFDA', N'供应商联系人手机', N'供应商联系人手机', N'文本', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='GFDA' AND col_name=N'供应商联系人座机')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('GFDA', N'供应商联系人座机', N'供应商联系人座机', N'文本', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='GFDA' AND col_name=N'供应商联系人邮箱')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('GFDA', N'供应商联系人邮箱', N'供应商联系人邮箱', N'文本', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='GFDA' AND col_name=N'供应商联系人地址')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('GFDA', N'供应商联系人地址', N'供应商联系人地址', N'文本', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='EMP' AND col_name=N'邮箱')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('EMP', N'邮箱', N'邮箱', N'文本', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='EMP' AND col_name=N'生日')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('EMP', N'生日', N'生日', N'文本', N'detail', 900, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='EMP' AND col_name=N'微信')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('EMP', N'微信', N'微信', N'文本', N'detail', 900, 130, 1, 0, 0, 1);
GO

-- ══ 新增标签英文译名(其余语言由机翻兜底)══
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'创建时间' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'创建时间', 'en', N'Created At', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'修改时间' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'修改时间', 'en', N'Modified At', 'manual');
-- ⚠ 待补英译:备注
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'创建人' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'创建人', 'en', N'Created By', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'修改人' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'修改人', 'en', N'Modified By', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'长编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'长编码', 'en', N'Long Code', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'精度处理' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'精度处理', 'en', N'Precision Handling', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'是否叶子节点' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'是否叶子节点', 'en', N'Leaf Node', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'级次' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'级次', 'en', N'Level', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'部门全称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'部门全称', 'en', N'Full Dept. Name', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'上级编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'上级编码', 'en', N'Parent Code', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'性别' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'性别', 'en', N'Gender', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'部门编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'部门编码', 'en', N'Dept. Code', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'入职日期' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'入职日期', 'en', N'Hire Date', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'离职日期' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'离职日期', 'en', N'Leave Date', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'仓库分类' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'仓库分类', 'en', N'Warehouse Group', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'仓库分类编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'仓库分类编码', 'en', N'Warehouse Group Code', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'国家' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'国家', 'en', N'Country', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'省' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'省', 'en', N'Province', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'市' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'市', 'en', N'City', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'区' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'区', 'en', N'District', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'启用仓位管理' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'启用仓位管理', 'en', N'Bin Management', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'仓库管理员编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'仓库管理员编码', 'en', N'Keeper Code', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'供应商分类编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'供应商分类编码', 'en', N'Supplier Group Code', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'增值税税率' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'增值税税率', 'en', N'VAT Rate (%)', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'开票名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'开票名称', 'en', N'Invoice Name', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'开户地址' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'开户地址', 'en', N'Bank Address', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'采购员部门' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'采购员部门', 'en', N'Purchaser Dept.', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'自动抵扣预收款' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'自动抵扣预收款', 'en', N'Auto Offset Advance', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'助记码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'助记码', 'en', N'Mnemonic Code', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'产地' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'产地', 'en', N'Origin', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'商品类型' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'商品类型', 'en', N'Item Type', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'是否可销售' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'是否可销售', 'en', N'Sellable', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'是否可采购' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'是否可采购', 'en', N'Purchasable', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'是否为子件' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'是否为子件', 'en', N'Can Be Component', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'是否为组件' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'是否为组件', 'en', N'Can Be Assembly', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'是否多单位' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'是否多单位', 'en', N'Multi-UOM', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助单位' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助单位', 'en', N'Aux. UOM', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助单位编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助单位编码', 'en', N'Aux. UOM Code', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'是否启用保质期' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'是否启用保质期', 'en', N'Shelf-life Enabled', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'保质期' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'保质期', 'en', N'Shelf Life', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'保质期单位' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'保质期单位', 'en', N'Shelf-life Unit', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'预警天数' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'预警天数', 'en', N'Alarm Days', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'是否启用辅助属性' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'是否启用辅助属性', 'en', N'Aux. Attributes', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'库存管理方式' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'库存管理方式', 'en', N'Inventory Mode', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'最低库存' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'最低库存', 'en', N'Min. Stock', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'最高库存' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'最高库存', 'en', N'Max. Stock', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'预警库存' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'预警库存', 'en', N'Alarm Stock', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'销项税率' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'销项税率', 'en', N'Output Tax Rate', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'进项税率' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'进项税率', 'en', N'Input Tax Rate', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'生产许可证' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'生产许可证', 'en', N'Production License', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'注册证号' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'注册证号', 'en', N'Registration No.', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'毛重' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'毛重', 'en', N'Gross Weight', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'净重' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'净重', 'en', N'Net Weight', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'长' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'长', 'en', N'Length', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'宽' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'宽', 'en', N'Width', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'高' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'高', 'en', N'Height', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'体积' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'体积', 'en', N'Volume', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'可用库存' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'可用库存', 'en', N'Available Stock', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'即时库存' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'即时库存', 'en', N'On-hand Stock', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'最小包装量' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'最小包装量', 'en', N'Min. Package Qty', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'默认生产车间编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'默认生产车间编码', 'en', N'Default Workshop Code', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'是否倒冲领料' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'是否倒冲领料', 'en', N'Backflush Issue', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'倒冲仓库名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'倒冲仓库名称', 'en', N'Backflush Warehouse', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'倒冲仓库编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'倒冲仓库编码', 'en', N'Backflush Warehouse Code', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'倒冲仓位名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'倒冲仓位名称', 'en', N'Backflush Bin', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'商品标签' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'商品标签', 'en', N'Item Labels', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'品牌编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'品牌编码', 'en', N'Brand Code', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'默认仓库' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'默认仓库', 'en', N'Default Warehouse', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'默认仓库编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'默认仓库编码', 'en', N'Default Warehouse Code', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'基本单位编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'基本单位编码', 'en', N'Base UOM Code', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'是否自制' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'是否自制', 'en', N'Self-made', 'manual');
-- ⚠ 待补英译:是否启用称重
-- ⚠ 待补英译:是否序列号管理
-- ⚠ 待补英译:是否批次管理
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'多单位' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'多单位', 'en', N'Multi-UOM List', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'图片链接' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'图片链接', 'en', N'Image URL', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'采购价' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'采购价', 'en', N'Purchase Price', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'零售价' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'零售价', 'en', N'Retail Price', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'批发价' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'批发价', 'en', N'Wholesale Price', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'配送价' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'配送价', 'en', N'Distribution Price', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'最低销售价' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'最低销售价', 'en', N'Min. Sales Price', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'最高采购价' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'最高采购价', 'en', N'Max. Purchase Price', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'最近采购价' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'最近采购价', 'en', N'Last Purchase Price', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'最近销售价' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'最近销售价', 'en', N'Last Sales Price', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'最近含税采购价' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'最近含税采购价', 'en', N'Last Purchase Price (Tax incl.)', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'最近含税销售价' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'最近含税销售价', 'en', N'Last Sales Price (Tax incl.)', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'最近采购入库成本' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'最近采购入库成本', 'en', N'Last Purchase Receipt Cost', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'最近成交供应商' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'最近成交供应商', 'en', N'Last Supplier', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'委外价' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'委外价', 'en', N'Outsource Price', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'价格单位' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'价格单位', 'en', N'Price UOM', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'客户分类编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'客户分类编码', 'en', N'Customer Group Code', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'价格等级编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'价格等级编码', 'en', N'Price Level Code', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'业务员编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'业务员编码', 'en', N'Salesperson Code', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'结算客户' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'结算客户', 'en', N'Settle Customer', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'结算客户编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'结算客户编码', 'en', N'Settle Customer Code', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'部门' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'部门', 'en', N'Department', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'发票类型' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'发票类型', 'en', N'Invoice Type', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'国家编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'国家编码', 'en', N'Country Code', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'省份编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'省份编码', 'en', N'Province Code', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'城市编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'城市编码', 'en', N'City Code', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'区县编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'区县编码', 'en', N'District Code', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'结算期限' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'结算期限', 'en', N'Settlement Term', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'结算期限编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'结算期限编码', 'en', N'Settlement Term Code', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'信用额度' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'信用额度', 'en', N'Credit Limit', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'收票邮箱' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'收票邮箱', 'en', N'Invoice Email', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'收票手机号' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'收票手机号', 'en', N'Invoice Mobile', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'联系人性别' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'联系人性别', 'en', N'Contact Gender', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'首要联系人' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'首要联系人', 'en', N'Primary Contact', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'联系人手机' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'联系人手机', 'en', N'Contact Mobile', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'联系人座机' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'联系人座机', 'en', N'Contact Phone', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'联系人邮箱' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'联系人邮箱', 'en', N'Contact Email', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'联系人生日' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'联系人生日', 'en', N'Contact Birthday', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'联系人QQ' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'联系人QQ', 'en', N'Contact QQ', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'联系人微信' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'联系人微信', 'en', N'Contact WeChat', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'联系人地址' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'联系人地址', 'en', N'Contact Address', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'联系人' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'联系人', 'en', N'Contact', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'供应商联系人手机' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'供应商联系人手机', 'en', N'Supplier Contact Mobile', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'供应商联系人座机' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'供应商联系人座机', 'en', N'Supplier Contact Phone', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'供应商联系人邮箱' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'供应商联系人邮箱', 'en', N'Supplier Contact Email', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'供应商联系人地址' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'供应商联系人地址', 'en', N'Supplier Contact Address', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'邮箱' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'邮箱', 'en', N'Email', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'生日' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'生日', 'en', N'Birthday', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'微信' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'微信', 'en', N'WeChat', 'manual');
GO

PRINT N'migrate-kingdee-archive-fields 完成(档案字段按接口补齐)';
GO