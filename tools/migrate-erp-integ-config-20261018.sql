-- =====================================================================================
-- migrate-erp-integ-config-20261018.sql — ERP系统集成:导航一级目录 + 集成配置清单三张表
--
-- 用户口径(2026-10-18):
--   ① 「在系统左侧菜单写一个 erp 系统集成的目录,目录下把 erp 导入日志移动到他下方」;
--   ② 「再写一个 erp 集成配置清单,分为导入与转出两种面板,针对每个面板的,然后每个面板再分类,
--       将他们每个面板的 api 接口、对应的设备、字段间的映射,做成一个可视化、可以统一配置编辑的面板」。
--
-- 本源文件做的事(幂等,可重复执行):
--   A. 三张配置表(ERP 集成接口清单 / 字段映射 / 设备绑定),带中文表列注明;
--   B. ERP导入日志(ERPLG / ERPLG_ROW)的 category / module_group 由「数据建模」改为「ERP系统集成」
--      —— 它已随菜单迁出新的一级目录,权限矩阵里的模块分组也随之归位;
--   C. 现场配置种子:转出侧 7 张单据 = KingdeePushService 里**已在跑**的推送口径(接口地址/字段/常量
--      全部照代码实录),导入侧 = 转出取 ID 与挂源单时实际拉取的金蝶档案/订单接口;
--      金蝶侧未开通或未实测的接口一律 启用=0 + 说明里写明原因(不假装能用);
--   D. 设备绑定:从 bs_equip 现存 6 台设备(SB001..SB006)按用途绑定(报工采集 / 点检对象 / 保养对象);
--   E. 多语言词条(yj_translation:panel + field),口径见 AGENTS.md「多语言强制规范」。
--
-- 执行:tools\DbSync(两账套 HSDZ_MES → HSDZ_MES_TEST 各跑一次)
-- 回退:DELETE FROM erp_integ_device; DELETE FROM erp_integ_field; DELETE FROM erp_integ_api;
--       DROP TABLE erp_integ_device, erp_integ_field, erp_integ_api;
--       UPDATE yj_panel SET category=N'数据建模', module_group=N'数据建模' WHERE panel_code IN ('ERPLG','ERPLG_ROW');
-- =====================================================================================
SET NOCOUNT ON;
GO

/* ══════════════════════ A. 三张配置表 ══════════════════════ */
IF OBJECT_ID(N'dbo.erp_integ_api', N'U') IS NULL
CREATE TABLE dbo.erp_integ_api (
    [id] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [方向] nvarchar(16) NOT NULL,              -- 导入 = 金蝶→MES;转出 = MES→金蝶
    [分类] nvarchar(40) NOT NULL,              -- 基础资料 / 单据 / 设备
    [接口编码] nvarchar(60) NOT NULL,          -- 全局唯一:IMP_* 导入 / EXP_* 转出
    [接口名称] nvarchar(120) NOT NULL,
    [提供方] nvarchar(60) NULL,
    [接口地址] nvarchar(300) NULL,
    [请求方式] nvarchar(10) NULL,
    [对应面板] nvarchar(60) NULL,              -- MES 侧面板编码(yj_panel.panel_code)
    [目标对象] nvarchar(120) NULL,             -- 金蝶侧单据/档案名
    [触发方式] nvarchar(40) NULL,
    [启用] bit NOT NULL CONSTRAINT df_erp_integ_api_enabled DEFAULT (1),
    [排序] int NOT NULL CONSTRAINT df_erp_integ_api_seq DEFAULT (0),
    [说明] nvarchar(600) NULL,
    asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL,
    asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel nvarchar(1) NULL
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ux_erp_integ_api_code' AND object_id = OBJECT_ID(N'dbo.erp_integ_api'))
    CREATE UNIQUE INDEX ux_erp_integ_api_code ON dbo.erp_integ_api([接口编码]);
GO

IF OBJECT_ID(N'dbo.erp_integ_field', N'U') IS NULL
CREATE TABLE dbo.erp_integ_field (
    [id] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [接口编码] nvarchar(60) NOT NULL,          -- FK erp_integ_api.接口编码(逻辑关联,随接口删除级联清理)
    [方向] nvarchar(16) NULL,
    [序号] int NOT NULL CONSTRAINT df_erp_integ_field_seq DEFAULT (0),
    [映射层级] nvarchar(16) NULL,              -- 表头 / 明细 / 常量
    [MES字段] nvarchar(120) NULL,              -- 面板字段名(与 yj_field.label 同源)或常量名
    [ERP字段] nvarchar(120) NULL,              -- 金蝶接口字段名(如 material_number/stock_id)
    [转换规则] nvarchar(40) NULL,              -- 直传 / 常量 / 档案解析 / 日期格式化 / 数值转字符串 / 查重
    [是否必填] bit NOT NULL CONSTRAINT df_erp_integ_field_req DEFAULT (0),
    [启用] bit NOT NULL CONSTRAINT df_erp_integ_field_enabled DEFAULT (1),
    [备注] nvarchar(400) NULL,
    asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL,
    asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel nvarchar(1) NULL
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_erp_integ_field_code' AND object_id = OBJECT_ID(N'dbo.erp_integ_field'))
    CREATE INDEX ix_erp_integ_field_code ON dbo.erp_integ_field([接口编码], [序号]);
GO

IF OBJECT_ID(N'dbo.erp_integ_device', N'U') IS NULL
CREATE TABLE dbo.erp_integ_device (
    [id] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [接口编码] nvarchar(60) NOT NULL,          -- FK erp_integ_api.接口编码
    [设备编码] nvarchar(50) NOT NULL,          -- bs_equip.设备编码
    [设备名称] nvarchar(100) NULL,             -- 冗余留存:设备改名/停用后仍能看清当初绑的是哪台
    [设备用途] nvarchar(40) NULL,              -- 产量采集 / 点检对象 / 保养对象 / 数据来源
    [备注] nvarchar(300) NULL,
    asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL,
    asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel nvarchar(1) NULL
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_erp_integ_device_code' AND object_id = OBJECT_ID(N'dbo.erp_integ_device'))
    CREATE INDEX ix_erp_integ_device_code ON dbo.erp_integ_device([接口编码], [设备编码]);
GO

/* ══════════════════════ A2. 表 / 关键列中文注明(AGENTS 强制:只建表不注明 = 未完成) ══════════════════════ */
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.erp_integ_api') AND minor_id = 0 AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'ERP集成接口配置(一张接口一行:方向=导入/转出、分类=基础资料/单据/设备、接口地址、对应MES面板、启用与排序;界面=ERP系统集成·ERP集成配置清单)', N'SCHEMA', N'dbo', N'TABLE', N'erp_integ_api';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.erp_integ_field') AND minor_id = 0 AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'ERP集成字段映射(一行=一个 MES 字段/常量 → 金蝶接口字段,含映射层级/转换规则/必填;界面按接口分组编辑)', N'SCHEMA', N'dbo', N'TABLE', N'erp_integ_field';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.erp_integ_device') AND minor_id = 0 AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'ERP集成设备绑定(一行=接口 × 设备:该接口的数据来自哪些设备/作用于哪些设备,设备编码取 bs_equip)', N'SCHEMA', N'dbo', N'TABLE', N'erp_integ_device';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.erp_integ_api') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.erp_integ_api'), N'对应面板', 'ColumnId') AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'MES 侧承载面板编码(取 yj_panel.panel_code,与该面板的字段名一一对应;空=纯档案/设备类接口)', N'SCHEMA', N'dbo', N'TABLE', N'erp_integ_api', N'COLUMN', N'对应面板';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.erp_integ_field') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.erp_integ_field'), N'转换规则', 'ColumnId') AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'取值为 直传/常量/档案解析/日期格式化/数值转字符串/查重:描述该字段从 MES 值到金蝶值怎么变(档案解析=按金蝶档案换成 *id)', N'SCHEMA', N'dbo', N'TABLE', N'erp_integ_field', N'COLUMN', N'转换规则';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.erp_integ_device') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.erp_integ_device'), N'设备用途', 'ColumnId') AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'该设备在本接口里的角色:产量采集(数据来源)/点检对象/保养对象/数据来源', N'SCHEMA', N'dbo', N'TABLE', N'erp_integ_device', N'COLUMN', N'设备用途';
GO

/* ══════════════════════ B. ERP导入日志归位「ERP系统集成」 ══════════════════════ */
UPDATE yj_panel
   SET category = N'ERP系统集成', module_group = N'ERP系统集成'
 WHERE panel_code IN ('ERPLG', 'ERPLG_ROW')
   AND (ISNULL(category, N'') <> N'ERP系统集成' OR ISNULL(module_group, N'') <> N'ERP系统集成');
GO

/* ══════════════════════ C. 接口种子(转出=现役推送口径,导入=现役拉取口径) ══════════════════════ */
DECLARE @api TABLE (
    [方向] nvarchar(16), [分类] nvarchar(40), [接口编码] nvarchar(60), [接口名称] nvarchar(120),
    [提供方] nvarchar(60), [接口地址] nvarchar(300), [请求方式] nvarchar(10), [对应面板] nvarchar(60),
    [目标对象] nvarchar(120), [触发方式] nvarchar(40), [启用] bit, [排序] int, [说明] nvarchar(600)
);

INSERT INTO @api VALUES
-- ── 导入:基础资料(金蝶 → MES) ──
(N'导入', N'基础资料', N'IMP_MATERIAL', N'商品档案导入', N'金蝶云星辰', N'/jdy/v2/bd/material', N'GET', N'INV', N'商品档案', N'定时同步', 1, 10,
 N'金蝶商品主数据拉入 MES 商品档案(存货编码/名称/规格型号/条形码);转出时 material_id 也按这张接口同源取 ID'),
(N'导入', N'基础资料', N'IMP_STORE', N'仓库档案导入', N'金蝶云星辰', N'/jdy/v2/bd/store', N'GET', N'WH', N'仓库档案', N'定时同步', 1, 20,
 N'仓库编码/名称 → MES 仓库档案;转出时 stock_id 按此接口的仓库 id 映射'),
(N'导入', N'基础资料', N'IMP_UOM', N'计量单位导入', N'金蝶云星辰', N'/jdy/v2/bd/measure_unit', N'GET', N'UOM', N'计量单位档案', N'定时同步', 1, 30,
 N'计量单位 → MES 计量单位档案;转出的 unit_id 必须按**当前账套**实时拉取(跨账套 ID 会静默错单位)'),
(N'导入', N'基础资料', N'IMP_EMP', N'职员档案导入', N'金蝶云星辰', N'/jdy/v2/bd/emp', N'GET', N'EMP', N'职员档案', N'定时同步', 1, 40,
 N'职员编码/名称 → MES 职员档案;产品入库/材料出库/其他出库推 emp_id 时按此接口解析'),
(N'导入', N'基础资料', N'IMP_DEPT', N'部门档案导入', N'金蝶云星辰', N'/jdy/v2/bd/department', N'GET', N'DEPT', N'部门档案', N'定时同步', 1, 50,
 N'部门编码/名称 → MES 部门档案;推 dept_id 时按此接口解析'),
(N'导入', N'基础资料', N'IMP_SUPPLIER', N'供应商档案导入', N'金蝶云星辰', N'/jdy/v2/bd/supplier', N'GET', N'GFDA', N'供应商档案', N'定时同步', 0, 60,
 N'接口地址待真实账套实测后启用(金蝶星辰开放接口清单里未逐条核对过该路径);MES 供应商现状由人工/Excel 维护'),
(N'导入', N'基础资料', N'IMP_CUSTOMER', N'客户档案导入', N'金蝶云星辰', N'/jdy/v2/bd/customer', N'GET', N'KHDA', N'客户档案', N'定时同步', 0, 70,
 N'同供应商:路径待账套实测后启用'),
-- ── 导入:单据(金蝶 → MES) ──
(N'导入', N'单据', N'IMP_PU_ORDER', N'采购订单导入', N'金蝶云星辰', N'/jdy/v2/scm/pur_order', N'GET', N'PU_ORDER', N'采购订单', N'定时同步', 1, 80,
 N'表头取 pur_order、分录取 /jdy/v2/scm/pur_order_detail;转出挂源单(src_bill_no/src_seq)时按订单号+行号解析'),
(N'导入', N'单据', N'IMP_SO_ORDER', N'销售订单导入', N'金蝶云星辰', N'/jdy/v2/scm/sal_order', N'GET', N'SO_ORDER', N'销售订单', N'定时同步', 1, 90,
 N'表头取 sal_order、分录取 /jdy/v2/scm/sal_order_detail;销售出库单挂源单时按订单号+行号解析'),
-- ── 导入:设备(金蝶 → MES;金蝶侧模块未开通,先留配置位) ──
(N'导入', N'设备', N'IMP_EQUIP', N'设备台账导入', N'金蝶云星辰', N'/jdy/v2/bd/equipment', N'GET', N'EQUIP', N'设备档案', N'手动', 0, 100,
 N'金蝶侧未开通设备/固定资产模块:先留配置位,开通后按实际路径改写并置启用=1'),
(N'导入', N'设备', N'IMP_MAINT', N'设备保养计划导入', N'金蝶云星辰', N'/jdy/v2/bd/maintain_plan', N'GET', N'MAINT_PLAN', N'保养计划', N'手动', 0, 110,
 N'同上;保养对象设备见「设备绑定」页签'),
-- ── 转出:单据(MES → 金蝶;全部为现役「转ERP」按钮口径) ──
(N'转出', N'单据', N'EXP_PU_ORDER', N'采购订单转出', N'金蝶云星辰', N'/jdy/v2/scm/pur_order', N'POST', N'PU_ORDER', N'采购订单', N'转ERP按钮', 1, 10,
 N'带 bill_no 推送(沿用 YJ- 编号),金蝶侧同号便于下游入库单挂源单;数量/价格按字符串传(proto 校验)'),
(N'转出', N'单据', N'EXP_PUR_IN', N'采购入库单转出', N'金蝶云星辰', N'/jdy/v2/scm/pur_inbound', N'POST', N'PURCHASE_IN', N'采购入库单', N'转ERP按钮', 1, 20,
 N'带 src_bill_no/src_seq 挂采购订单来源单;解析不到订单时整组源单引用不推(不阻断)'),
(N'转出', N'单据', N'EXP_SALE_OUT', N'销售出库单转出', N'金蝶云星辰', N'/jdy/v2/scm/sal_out_bound', N'POST', N'SALE_OUT', N'销售出库单', N'转ERP按钮', 1, 30,
 N'挂销售订单来源单(src_bill_type_id=sal_bill_order);src_seq 必须在订单确有该分录时才推'),
(N'转出', N'单据', N'EXP_MAT_OUT', N'材料出库单转出', N'金蝶云星辰', N'/jdy/v2/scm/inv_pick', N'POST', N'MATERIAL_OUT', N'生产领料单', N'转ERP按钮', 1, 40,
 N'金蝶 inv_pick 头无供应商/客户/仓库/业务类型;部门+经手人按档案解析,仓库只认 stock_id'),
(N'转出', N'单据', N'EXP_FINISH_IN', N'产品入库单转出', N'金蝶云星辰', N'/jdy/v2/scm/inv_product', N'POST', N'FINISH_IN', N'产品入库单', N'转ERP按钮', 1, 50,
 N'数量族必须传字符串;无税金族与价格族;material_model 实测被静默忽略故不推'),
(N'转出', N'单据', N'EXP_OTHER_IN', N'其他入库单转出', N'金蝶云星辰', N'/jdy/v2/scm/inv_other_in', N'POST', N'OTHER_IN', N'其他入库单', N'转ERP按钮', 1, 60,
 N'业务类型 trans_type_id 必填(金蝶无业务类型档案接口),默认 12;成本/单位成本有值才推'),
(N'转出', N'单据', N'EXP_OTHER_OUT', N'其他出库单转出', N'金蝶云星辰', N'/jdy/v2/scm/inv_other_out', N'POST', N'OTHER_OUT', N'其他出库单', N'转ERP按钮', 1, 70,
 N'业务类型 trans_type_id 默认 13;对方单位取部门+经手人(实测 97% 有值)'),
-- ── 转出:基础资料(MES → 金蝶;规划中) ──
(N'转出', N'基础资料', N'EXP_SUPPLIER', N'供应商档案推送', N'金蝶云星辰', N'/jdy/v2/bd/supplier', N'POST', N'GFDA', N'供应商档案', N'手动', 0, 80,
 N'规划:MES 新建供应商时同步金蝶;接口路径待账套实测'),
(N'转出', N'基础资料', N'EXP_CUSTOMER', N'客户档案推送', N'金蝶云星辰', N'/jdy/v2/bd/customer', N'POST', N'KHDA', N'客户档案', N'手动', 0, 90,
 N'规划:客户档案单向同步;待实测'),
(N'转出', N'基础资料', N'EXP_MATERIAL', N'商品档案推送', N'金蝶云星辰', N'/jdy/v2/bd/material', N'POST', N'INV', N'商品档案', N'手动', 0, 100,
 N'规划:仅推送 MES 自建商品;金蝶已有商品不覆盖(待实测保存接口字段口径)'),
-- ── 转出:设备(MES → 金蝶;金蝶侧未开通) ──
(N'转出', N'设备', N'EXP_WO_REPORT', N'工序报工数据转出', N'金蝶云星辰', N'/jdy/v2/scm/prod_report', N'POST', N'WO_REPORT', N'生产报工单', N'定时同步', 0, 110,
 N'设备采集的报工数据按设备汇总转出;金蝶星辰报工接口未开通,先留配置位(设备绑定见「设备绑定」)'),
(N'转出', N'设备', N'EXP_EQUIP_CHECK', N'设备点检记录转出', N'金蝶云星辰', N'/jdy/v2/bd/equip_inspect', N'POST', N'EQUIP_CHECK', N'设备点检记录', N'定时同步', 0, 120,
 N'点检记录按设备汇总转出;同上,金蝶侧接口未开通');

INSERT INTO erp_integ_api ([方向], [分类], [接口编码], [接口名称], [提供方], [接口地址], [请求方式],
                           [对应面板], [目标对象], [触发方式], [启用], [排序], [说明],
                           asp_user1, asp_time1, asp_user2, asp_time2, asp_cancel)
SELECT a.[方向], a.[分类], a.[接口编码], a.[接口名称], a.[提供方], a.[接口地址], a.[请求方式],
       a.[对应面板], a.[目标对象], a.[触发方式], a.[启用], a.[排序], a.[说明],
       N'system', SYSDATETIME(), N'system', SYSDATETIME(), N'N'
  FROM @api a
 WHERE NOT EXISTS (SELECT 1 FROM erp_integ_api x WHERE x.[接口编码] = a.[接口编码]);
PRINT N'  C. 接口种子(导入 11 / 转出 12)';
GO

/* ══════════════════════ D. 字段映射种子 ══════════════════════ */
DECLARE @f TABLE (
    [接口编码] nvarchar(60), [序号] int, [映射层级] nvarchar(16), [MES字段] nvarchar(120),
    [ERP字段] nvarchar(120), [转换规则] nvarchar(40), [是否必填] bit, [启用] bit, [备注] nvarchar(400)
);
INSERT INTO @f VALUES
-- ── 转出 · 采购订单 ──
(N'EXP_PU_ORDER', 10, N'表头', N'单据编号', N'bill_no', N'直传', 1, 1, N'沿用 MES 编号(YJ-…),金蝶侧同号,下游入库单按号挂源单'),
(N'EXP_PU_ORDER', 20, N'表头', N'单据日期', N'bill_date', N'日期格式化', 1, 1, N'yyyy-MM-dd'),
(N'EXP_PU_ORDER', 30, N'表头', N'供应商编码', N'supplier_number', N'直传', 1, 1, N'空则金蝶拒单;取 bs_supplier.供应商编码'),
(N'EXP_PU_ORDER', 40, N'表头', N'备注', N'remark', N'直传', 0, 1, N'推送时自动追加 [MES:单号] 便于双向追溯'),
(N'EXP_PU_ORDER', 50, N'明细', N'物料编码', N'material_number', N'直传', 1, 1, N''),
(N'EXP_PU_ORDER', 60, N'明细', N'物料编码', N'material_id', N'档案解析', 0, 1, N'按金蝶商品档案换 ID;挂源单/重推时必须与源单分录一致'),
(N'EXP_PU_ORDER', 70, N'明细', N'数量', N'qty', N'数值转字符串', 1, 1, N'采购订单接口 proto 校验收字符串'),
(N'EXP_PU_ORDER', 80, N'明细', N'单价', N'price', N'数值转字符串', 1, 1, N'同上'),
(N'EXP_PU_ORDER', 90, N'明细', N'税率%', N'cess', N'数值转字符串', 0, 1, N'为 0 不推'),
(N'EXP_PU_ORDER', 100, N'明细', N'规格型号', N'material_model', N'直传', 0, 1, N'订单接口收该键(入库/产品入库接口忽略)'),
(N'EXP_PU_ORDER', 110, N'明细', N'单位', N'unit_id', N'档案解析', 1, 1, N'按当前账套 measure_unit 换 ID,跨账套 ID 不通用'),

-- ── 转出 · 采购入库单 ──
(N'EXP_PUR_IN', 10, N'表头', N'单据日期', N'bill_date', N'日期格式化', 1, 1, N''),
(N'EXP_PUR_IN', 20, N'表头', N'业务类型', N'trans_type', N'常量', 1, 1, N'固定 2(入库单);采购订单/生产领料/产品入库无此项'),
(N'EXP_PUR_IN', 30, N'表头', N'供应商编码', N'supplier_number', N'直传', 1, 1, N''),
(N'EXP_PUR_IN', 40, N'表头', N'备注', N'remark', N'直传', 0, 1, N'追加 [MES:单号]'),
(N'EXP_PUR_IN', 50, N'表头', N'采购订单号', N'src_bill_no', N'档案解析', 0, 1, N'仅当订单在金蝶解析到才推整组源单;否则不挂来源单并提示'),
(N'EXP_PUR_IN', 60, N'表头', N'(常量)', N'src_bill_type_id', N'常量', 0, 1, N'固定 pur_bill_order,缺它金蝶会静默忽略源单引用'),
(N'EXP_PUR_IN', 70, N'明细', N'存货编码', N'material_number', N'直传', 1, 1, N''),
(N'EXP_PUR_IN', 80, N'明细', N'存货编码', N'material_id', N'档案解析', 0, 1, N'挂来源单时必须有,否则整单被拒'),
(N'EXP_PUR_IN', 90, N'明细', N'实收数量', N'qty', N'直传', 1, 1, N''),
(N'EXP_PUR_IN', 100, N'明细', N'单价', N'price', N'直传', 0, 1, N''),
(N'EXP_PUR_IN', 110, N'明细', N'税率%', N'cess', N'直传', 0, 1, N'为 0 不推'),
(N'EXP_PUR_IN', 120, N'明细', N'规格型号', N'material_model', N'直传', 0, 1, N''),
(N'EXP_PUR_IN', 130, N'明细', N'计量单位', N'unit_id', N'档案解析', 1, 1, N'无对应 ID 直接报错(不静默错单位)'),
(N'EXP_PUR_IN', 140, N'明细', N'仓库编码', N'stock_number', N'直传', 0, 1, N'行级 → 头级 → 默认正品仓 CK00001'),
(N'EXP_PUR_IN', 150, N'明细', N'仓库编码', N'stock_id', N'档案解析', 0, 1, N'金蝶保存只认 stock_id,必须带'),
(N'EXP_PUR_IN', 160, N'明细', N'批号', N'batch_no', N'直传', 0, 1, N''),
(N'EXP_PUR_IN', 170, N'明细', N'采购订单行号', N'src_seq', N'直传', 0, 1, N'订单确有该分录才推,否则整单被拒'),
(N'EXP_PUR_IN', 180, N'明细', N'采购订单行号', N'src_entry_id', N'档案解析', 0, 1, N'按订单分录换金蝶 entry id'),

-- ── 转出 · 销售出库单 ──
(N'EXP_SALE_OUT', 10, N'表头', N'单据日期', N'bill_date', N'日期格式化', 1, 1, N''),
(N'EXP_SALE_OUT', 20, N'表头', N'业务类型', N'trans_type', N'常量', 1, 1, N'固定 2'),
(N'EXP_SALE_OUT', 30, N'表头', N'客户编码', N'customer_number', N'直传', 1, 1, N''),
(N'EXP_SALE_OUT', 40, N'表头', N'备注', N'remark', N'直传', 0, 1, N'追加 [MES:单号]'),
(N'EXP_SALE_OUT', 50, N'表头', N'销售订单号', N'src_bill_no', N'档案解析', 0, 1, N'解析到订单才挂来源单'),
(N'EXP_SALE_OUT', 60, N'表头', N'(常量)', N'src_bill_type_id', N'常量', 0, 1, N'固定 sal_bill_order(销售订单)'),
(N'EXP_SALE_OUT', 70, N'明细', N'存货编码', N'material_number', N'直传', 1, 1, N''),
(N'EXP_SALE_OUT', 80, N'明细', N'存货编码', N'material_id', N'档案解析', 0, 1, N''),
(N'EXP_SALE_OUT', 90, N'明细', N'数量', N'qty', N'直传', 1, 1, N''),
(N'EXP_SALE_OUT', 100, N'明细', N'售价', N'price', N'直传', 0, 1, N''),
(N'EXP_SALE_OUT', 110, N'明细', N'税率%', N'cess', N'直传', 0, 1, N'为 0 不推'),
(N'EXP_SALE_OUT', 120, N'明细', N'规格型号', N'material_model', N'直传', 0, 1, N''),
(N'EXP_SALE_OUT', 130, N'明细', N'计量单位', N'unit_id', N'档案解析', 1, 1, N''),
(N'EXP_SALE_OUT', 140, N'明细', N'仓库编码', N'stock_number', N'直传', 0, 1, N''),
(N'EXP_SALE_OUT', 150, N'明细', N'仓库编码', N'stock_id', N'档案解析', 0, 1, N''),
(N'EXP_SALE_OUT', 160, N'明细', N'批号', N'batch_no', N'直传', 0, 1, N''),
(N'EXP_SALE_OUT', 170, N'明细', N'销售订单行号', N'src_seq', N'直传', 0, 1, N''),
(N'EXP_SALE_OUT', 180, N'明细', N'销售订单行号', N'src_entry_id', N'档案解析', 0, 1, N''),

-- ── 转出 · 材料出库单(生产领料单) ──
(N'EXP_MAT_OUT', 10, N'表头', N'单据日期', N'bill_date', N'日期格式化', 1, 1, N''),
(N'EXP_MAT_OUT', 20, N'表头', N'生产车间', N'dept_number', N'档案解析', 0, 1, N'取部门名称换编码;解析不到不阻断'),
(N'EXP_MAT_OUT', 30, N'表头', N'领用人', N'emp_number', N'档案解析', 0, 1, N''),
(N'EXP_MAT_OUT', 40, N'表头', N'领用人', N'emp_id', N'档案解析', 0, 1, N'inv_pick 只认 emp_id,emp_number 被忽略'),
(N'EXP_MAT_OUT', 50, N'表头', N'领料类型', N'pick_type', N'直传', 0, 1, N'真实账套恒 1'),
(N'EXP_MAT_OUT', 60, N'表头', N'备注', N'remark', N'直传', 0, 1, N''),
(N'EXP_MAT_OUT', 70, N'明细', N'材料编码', N'material_number', N'直传', 1, 1, N''),
(N'EXP_MAT_OUT', 80, N'明细', N'材料编码', N'material_id', N'档案解析', 0, 1, N''),
(N'EXP_MAT_OUT', 90, N'明细', N'数量', N'qty', N'直传', 1, 1, N''),
(N'EXP_MAT_OUT', 100, N'明细', N'单价', N'price', N'直传', 0, 1, N''),
(N'EXP_MAT_OUT', 110, N'明细', N'成本', N'cost', N'直传', 0, 1, N'有值才推'),
(N'EXP_MAT_OUT', 120, N'明细', N'单位成本', N'unit_cost', N'直传', 0, 1, N'有值才推'),
(N'EXP_MAT_OUT', 130, N'明细', N'计量单位', N'unit_id', N'档案解析', 1, 1, N''),
(N'EXP_MAT_OUT', 140, N'明细', N'仓库编码', N'stock_number', N'直传', 0, 1, N''),
(N'EXP_MAT_OUT', 150, N'明细', N'仓库编码', N'stock_id', N'档案解析', 0, 1, N''),
(N'EXP_MAT_OUT', 160, N'明细', N'批号', N'batch_no', N'直传', 0, 1, N''),
(N'EXP_MAT_OUT', 170, N'明细', N'明细备注', N'comment', N'直传', 0, 1, N''),

-- ── 转出 · 产品入库单 ──
(N'EXP_FINISH_IN', 10, N'表头', N'单据日期', N'bill_date', N'日期格式化', 1, 1, N''),
(N'EXP_FINISH_IN', 20, N'表头', N'生产车间', N'dept_number', N'档案解析', 0, 1, N'取 部门编码 → 生产车间 顺序解析'),
(N'EXP_FINISH_IN', 30, N'表头', N'生产车间', N'dept_id', N'档案解析', 0, 1, N''),
(N'EXP_FINISH_IN', 40, N'表头', N'经手人', N'emp_number', N'档案解析', 0, 1, N''),
(N'EXP_FINISH_IN', 50, N'表头', N'经手人', N'emp_id', N'档案解析', 0, 1, N''),
(N'EXP_FINISH_IN', 60, N'表头', N'备注', N'remark', N'直传', 0, 1, N''),
(N'EXP_FINISH_IN', 70, N'明细', N'产品编码', N'material_number', N'直传', 1, 1, N''),
(N'EXP_FINISH_IN', 80, N'明细', N'产品编码', N'material_id', N'档案解析', 0, 1, N''),
(N'EXP_FINISH_IN', 90, N'明细', N'实收数量', N'qty', N'数值转字符串', 1, 1, N'产品入库数量族必须传字符串'),
(N'EXP_FINISH_IN', 100, N'明细', N'(行号)', N'seq', N'常量', 0, 1, N'按明细行顺序 1..n'),
(N'EXP_FINISH_IN', 110, N'明细', N'计量单位', N'unit_id', N'档案解析', 1, 1, N''),
(N'EXP_FINISH_IN', 120, N'明细', N'仓库编码', N'stock_number', N'直传', 0, 1, N''),
(N'EXP_FINISH_IN', 130, N'明细', N'仓库编码', N'stock_id', N'档案解析', 0, 1, N''),
(N'EXP_FINISH_IN', 140, N'明细', N'批次号', N'batch_no', N'直传', 0, 1, N'行上批号为空时退回表头批次号'),
(N'EXP_FINISH_IN', 150, N'明细', N'备注', N'comment', N'直传', 0, 1, N''),

-- ── 转出 · 其他入库单 ──
(N'EXP_OTHER_IN', 10, N'表头', N'单据日期', N'bill_date', N'日期格式化', 1, 1, N''),
(N'EXP_OTHER_IN', 20, N'表头', N'业务类型id', N'trans_type_id', N'常量', 1, 1, N'必填;空则回落账套默认 12(金蝶无业务类型档案接口)'),
(N'EXP_OTHER_IN', 30, N'表头', N'供应商编码', N'supplier_number', N'直传', 0, 1, N'空则按供应商名称回查 bs_supplier'),
(N'EXP_OTHER_IN', 40, N'表头', N'备注', N'remark', N'直传', 0, 1, N''),
(N'EXP_OTHER_IN', 50, N'明细', N'存货编码', N'material_number', N'直传', 1, 1, N''),
(N'EXP_OTHER_IN', 60, N'明细', N'存货编码', N'material_id', N'档案解析', 0, 1, N''),
(N'EXP_OTHER_IN', 70, N'明细', N'数量', N'qty', N'数值转字符串', 1, 1, N'与其他入库同族口径'),
(N'EXP_OTHER_IN', 80, N'明细', N'(行号)', N'seq', N'常量', 0, 1, N''),
(N'EXP_OTHER_IN', 90, N'明细', N'成本', N'cost', N'直传', 0, 1, N'有值才推'),
(N'EXP_OTHER_IN', 100, N'明细', N'单位成本', N'unit_cost', N'直传', 0, 1, N'有值才推'),
(N'EXP_OTHER_IN', 110, N'明细', N'计量单位', N'unit_id', N'档案解析', 1, 1, N''),
(N'EXP_OTHER_IN', 120, N'明细', N'仓库编码', N'stock_number', N'直传', 0, 1, N''),
(N'EXP_OTHER_IN', 130, N'明细', N'仓库编码', N'stock_id', N'档案解析', 0, 1, N''),
(N'EXP_OTHER_IN', 140, N'明细', N'批号', N'batch_no', N'直传', 0, 1, N''),

-- ── 转出 · 其他出库单 ──
(N'EXP_OTHER_OUT', 10, N'表头', N'单据日期', N'bill_date', N'日期格式化', 1, 1, N''),
(N'EXP_OTHER_OUT', 20, N'表头', N'业务类型id', N'trans_type_id', N'常量', 1, 1, N'必填;空则回落账套默认 13'),
(N'EXP_OTHER_OUT', 30, N'表头', N'部门编码', N'dept_number', N'档案解析', 0, 1, N'空则按部门名称回查 bs_dept'),
(N'EXP_OTHER_OUT', 40, N'表头', N'部门编码', N'dept_id', N'档案解析', 0, 1, N''),
(N'EXP_OTHER_OUT', 50, N'表头', N'经手人编码', N'emp_number', N'档案解析', 0, 1, N''),
(N'EXP_OTHER_OUT', 60, N'表头', N'经手人编码', N'emp_id', N'档案解析', 0, 1, N''),
(N'EXP_OTHER_OUT', 70, N'表头', N'备注', N'remark', N'直传', 0, 1, N''),
(N'EXP_OTHER_OUT', 80, N'明细', N'存货编码', N'material_number', N'直传', 1, 1, N''),
(N'EXP_OTHER_OUT', 90, N'明细', N'存货编码', N'material_id', N'档案解析', 0, 1, N''),
(N'EXP_OTHER_OUT', 100, N'明细', N'数量', N'qty', N'数值转字符串', 1, 1, N''),
(N'EXP_OTHER_OUT', 110, N'明细', N'(行号)', N'seq', N'常量', 0, 1, N''),
(N'EXP_OTHER_OUT', 120, N'明细', N'计量单位', N'unit_id', N'档案解析', 1, 1, N''),
(N'EXP_OTHER_OUT', 130, N'明细', N'仓库编码', N'stock_number', N'直传', 0, 1, N''),
(N'EXP_OTHER_OUT', 140, N'明细', N'仓库编码', N'stock_id', N'档案解析', 0, 1, N''),
(N'EXP_OTHER_OUT', 150, N'明细', N'批号', N'batch_no', N'直传', 0, 1, N''),

-- ── 导入 · 商品档案 ──
(N'IMP_MATERIAL', 10, N'档案', N'存货编码', N'material_number', N'直传', 1, 1, N'业务键:按编码 upsert'),
(N'IMP_MATERIAL', 20, N'档案', N'存货名称', N'name', N'直传', 1, 1, N''),
(N'IMP_MATERIAL', 30, N'档案', N'规格型号', N'model', N'直传', 0, 1, N''),
(N'IMP_MATERIAL', 40, N'档案', N'条形码', N'barcode', N'直传', 0, 1, N''),
-- ── 导入 · 仓库档案 ──
(N'IMP_STORE', 10, N'档案', N'仓库编码', N'number', N'直传', 1, 1, N''),
(N'IMP_STORE', 20, N'档案', N'仓库名称', N'name', N'直传', 1, 1, N''),
(N'IMP_STORE', 30, N'档案', N'仓库地址', N'address', N'直传', 0, 1, N''),
-- ── 导入 · 计量单位 ──
(N'IMP_UOM', 10, N'档案', N'计量单位编码', N'number', N'直传', 1, 1, N''),
(N'IMP_UOM', 20, N'档案', N'计量单位名称', N'name', N'直传', 1, 1, N''),
(N'IMP_UOM', 30, N'档案', N'换算率', N'rate', N'直传', 0, 1, N''),
-- ── 导入 · 职员 ──
(N'IMP_EMP', 10, N'档案', N'员工编码', N'number', N'直传', 1, 1, N''),
(N'IMP_EMP', 20, N'档案', N'员工名称', N'name', N'直传', 1, 1, N''),
(N'IMP_EMP', 30, N'档案', N'所属部门', N'dept_number', N'档案解析', 0, 1, N'按部门编码回查 bs_dept'),
-- ── 导入 · 部门 ──
(N'IMP_DEPT', 10, N'档案', N'部门编码', N'number', N'直传', 1, 1, N''),
(N'IMP_DEPT', 20, N'档案', N'部门名称', N'name', N'直传', 1, 1, N''),
(N'IMP_DEPT', 30, N'档案', N'上级部门', N'parent_number', N'直传', 0, 1, N''),
-- ── 导入 · 采购订单 ──
(N'IMP_PU_ORDER', 10, N'表头', N'单据编号', N'bill_no', N'直传', 1, 1, N'金蝶 bill_no → MES 单据编号(同号,转出挂源单靠它)'),
(N'IMP_PU_ORDER', 20, N'表头', N'单据日期', N'bill_date', N'日期格式化', 1, 1, N''),
(N'IMP_PU_ORDER', 30, N'表头', N'供应商编码', N'supplier_number', N'直传', 1, 1, N''),
(N'IMP_PU_ORDER', 40, N'表头', N'备注', N'remark', N'直传', 0, 1, N'剥掉 [MES:…] 追溯后缀'),
(N'IMP_PU_ORDER', 50, N'明细', N'物料编码', N'material_number', N'直传', 1, 1, N''),
(N'IMP_PU_ORDER', 60, N'明细', N'物料名称', N'material_name', N'直传', 0, 1, N''),
(N'IMP_PU_ORDER', 70, N'明细', N'数量', N'qty', N'直传', 1, 1, N''),
(N'IMP_PU_ORDER', 80, N'明细', N'单价', N'price', N'直传', 0, 1, N''),
(N'IMP_PU_ORDER', 90, N'明细', N'单位', N'unit_name', N'直传', 0, 1, N''),
-- ── 导入 · 销售订单 ──
(N'IMP_SO_ORDER', 10, N'表头', N'单据编号', N'bill_no', N'直传', 1, 1, N''),
(N'IMP_SO_ORDER', 20, N'表头', N'单据日期', N'bill_date', N'日期格式化', 1, 1, N''),
(N'IMP_SO_ORDER', 30, N'表头', N'客户编码', N'customer_number', N'直传', 1, 1, N''),
(N'IMP_SO_ORDER', 40, N'表头', N'备注', N'remark', N'直传', 0, 1, N''),
(N'IMP_SO_ORDER', 50, N'明细', N'存货编码', N'material_number', N'直传', 1, 1, N''),
(N'IMP_SO_ORDER', 60, N'明细', N'数量', N'qty', N'直传', 1, 1, N''),
(N'IMP_SO_ORDER', 70, N'明细', N'售价', N'price', N'直传', 0, 1, N''),
(N'IMP_SO_ORDER', 80, N'明细', N'计量单位', N'unit_name', N'直传', 0, 1, N''),
-- ── 导入 · 设备台账 / 保养计划(待开通) ──
(N'IMP_EQUIP', 10, N'档案', N'设备编码', N'number', N'直传', 1, 1, N'待金蝶侧开通设备模块后核对'),
(N'IMP_EQUIP', 20, N'档案', N'设备名称', N'name', N'直传', 1, 1, N''),
(N'IMP_EQUIP', 30, N'档案', N'设备型号', N'model', N'直传', 0, 1, N''),
(N'IMP_EQUIP', 40, N'档案', N'所属部门', N'dept_number', N'档案解析', 0, 1, N''),
(N'IMP_MAINT', 10, N'表头', N'设备编码', N'equip_number', N'直传', 1, 1, N'保养对象;与「设备绑定」页签同源'),
(N'IMP_MAINT', 20, N'表头', N'计划日期', N'plan_date', N'日期格式化', 0, 1, N''),
-- ── 转出 · 基础资料(规划) ──
(N'EXP_SUPPLIER', 10, N'档案', N'供应商编码', N'number', N'直传', 1, 0, N'规划中,启用前需账套实测'),
(N'EXP_SUPPLIER', 20, N'档案', N'供应商名称', N'name', N'直传', 1, 0, N''),
(N'EXP_SUPPLIER', 30, N'档案', N'开票税号', N'tax_no', N'直传', 0, 0, N''),
(N'EXP_CUSTOMER', 10, N'档案', N'客户编码', N'number', N'直传', 1, 0, N'规划中'),
(N'EXP_CUSTOMER', 20, N'档案', N'客户名称', N'name', N'直传', 1, 0, N''),
(N'EXP_CUSTOMER', 30, N'档案', N'电话', N'phone', N'直传', 0, 0, N''),
(N'EXP_MATERIAL', 10, N'档案', N'存货编码', N'number', N'直传', 1, 0, N'规划中'),
(N'EXP_MATERIAL', 20, N'档案', N'存货名称', N'name', N'直传', 1, 0, N''),
(N'EXP_MATERIAL', 30, N'档案', N'规格型号', N'model', N'直传', 0, 0, N''),
(N'EXP_MATERIAL', 40, N'档案', N'计量单位', N'unit_name', N'直传', 0, 0, N''),
-- ── 转出 · 设备(待开通) ──
(N'EXP_WO_REPORT', 10, N'表头', N'设备编码', N'equip_number', N'直传', 1, 0, N'设备采集的产量汇总键'),
(N'EXP_WO_REPORT', 20, N'表头', N'报工日期', N'date', N'日期格式化', 1, 0, N''),
(N'EXP_WO_REPORT', 30, N'明细', N'工单号', N'src_bill_no', N'直传', 1, 0, N''),
(N'EXP_WO_REPORT', 40, N'明细', N'工序编码', N'process_number', N'直传', 0, 0, N''),
(N'EXP_WO_REPORT', 50, N'明细', N'报工数量', N'qty', N'直传', 1, 0, N''),
(N'EXP_EQUIP_CHECK', 10, N'表头', N'设备编码', N'equip_number', N'直传', 1, 0, N''),
(N'EXP_EQUIP_CHECK', 20, N'表头', N'点检日期', N'date', N'日期格式化', 1, 0, N''),
(N'EXP_EQUIP_CHECK', 30, N'表头', N'点检结果', N'result', N'直传', 0, 0, N'');

INSERT INTO erp_integ_field ([接口编码], [方向], [序号], [映射层级], [MES字段], [ERP字段], [转换规则],
                             [是否必填], [启用], [备注],
                             asp_user1, asp_time1, asp_user2, asp_time2, asp_cancel)
SELECT f.[接口编码], ISNULL(a.[方向], N''), f.[序号], f.[映射层级], f.[MES字段], f.[ERP字段], f.[转换规则],
       f.[是否必填], f.[启用], f.[备注],
       N'system', SYSDATETIME(), N'system', SYSDATETIME(), N'N'
  FROM @f f
  LEFT JOIN erp_integ_api a ON a.[接口编码] = f.[接口编码]
 WHERE NOT EXISTS (SELECT 1 FROM erp_integ_field x
                    WHERE x.[接口编码] = f.[接口编码] AND x.[序号] = f.[序号] AND x.[ERP字段] = f.[ERP字段]);
PRINT N'  D. 字段映射种子';
GO

/* ══════════════════════ E. 设备绑定种子(设备以 bs_equip 现存 6 台为准) ══════════════════════ */
DECLARE @d TABLE ([接口编码] nvarchar(60), [设备编码] nvarchar(50), [设备用途] nvarchar(40), [备注] nvarchar(300));
INSERT INTO @d VALUES
(N'EXP_WO_REPORT', N'SB001', N'产量采集', N'锯床-01:报工数量按设备汇总后转出'),
(N'EXP_WO_REPORT', N'SB002', N'产量采集', N'锯床-02'),
(N'EXP_WO_REPORT', N'SB003', N'产量采集', N'数控车床-03'),
(N'EXP_WO_REPORT', N'SB004', N'产量采集', N'加工中心-02'),
(N'EXP_EQUIP_CHECK', N'SB001', N'点检对象', N'锯床-01 的日点检记录'),
(N'EXP_EQUIP_CHECK', N'SB002', N'点检对象', N'锯床-02 的日点检记录'),
(N'EXP_EQUIP_CHECK', N'SB003', N'点检对象', N'数控车床-03 的日点检记录'),
(N'EXP_EQUIP_CHECK', N'SB004', N'点检对象', N'加工中心-02 的日点检记录'),
(N'EXP_EQUIP_CHECK', N'SB005', N'点检对象', N'检测台-01'),
(N'EXP_EQUIP_CHECK', N'SB006', N'点检对象', N'检测台-02'),
(N'IMP_MAINT', N'SB001', N'保养对象', N'锯床-01 的保养计划由金蝶侧下发'),
(N'IMP_MAINT', N'SB002', N'保养对象', N'锯床-02'),
(N'IMP_MAINT', N'SB003', N'保养对象', N'数控车床-03'),
(N'IMP_MAINT', N'SB004', N'保养对象', N'加工中心-02');

INSERT INTO erp_integ_device ([接口编码], [设备编码], [设备名称], [设备用途], [备注],
                              asp_user1, asp_time1, asp_user2, asp_time2, asp_cancel)
SELECT d.[接口编码], d.[设备编码], e.[设备名称], d.[设备用途], d.[备注],
       N'system', SYSDATETIME(), N'system', SYSDATETIME(), N'N'
  FROM @d d
  OUTER APPLY (SELECT TOP 1 设备名称 FROM bs_equip
                WHERE 设备编码 = d.[设备编码] AND ISNULL(asp_cancel, N'N') <> N'Y') e
 WHERE NOT EXISTS (SELECT 1 FROM erp_integ_device x
                    WHERE x.[接口编码] = d.[接口编码] AND x.[设备编码] = d.[设备编码]);
PRINT N'  E. 设备绑定种子';
GO

/* ══════════════════════ F. 多语言词条(panel + field) ══════════════════════ */
DECLARE @t TABLE (scope varchar(20), ref_key nvarchar(120), locale varchar(10), text nvarchar(400));
INSERT INTO @t (scope, ref_key, locale, text) VALUES
 ('panel', N'ERP集成配置清单', 'en',    N'ERP Integration Config'),
 ('panel', N'ERP集成配置清单', 'zh-TW', N'ERP整合設定清單'),
 ('panel', N'ERP集成配置清单', 'ja',    N'ERP連携設定一覧'),
 ('panel', N'ERP集成配置清单', 'ko',    N'ERP 통합 설정 목록'),
 ('panel', N'ERP集成配置清单', 'es',    N'Configuración de integración ERP'),
 ('panel', N'ERP集成配置清单', 'fr',    N'Configuration d''intégration ERP'),
 ('panel', N'ERP集成配置清单', 'de',    N'ERP-Integrationskonfiguration'),
 ('panel', N'ERP集成配置清单', 'ru',    N'Настройка интеграции с ERP'),
 ('panel', N'ERP集成配置清单', 'vi',    N'Cấu hình tích hợp ERP'),
 ('panel', N'ERP集成配置清单', 'th',    N'การตั้งค่าการเชื่อมต่อ ERP'),
 ('panel', N'ERP系统集成',     'en',    N'ERP Integration'),
 ('panel', N'ERP系统集成',     'zh-TW', N'ERP系統整合'),
 ('panel', N'ERP系统集成',     'ja',    N'ERPシステム連携'),
 ('panel', N'ERP系统集成',     'ko',    N'ERP 시스템 통합'),
 ('panel', N'ERP系统集成',     'es',    N'Integración ERP'),
 ('panel', N'ERP系统集成',     'fr',    N'Intégration ERP'),
 ('panel', N'ERP系统集成',     'de',    N'ERP-Integration'),
 ('panel', N'ERP系统集成',     'ru',    N'Интеграция с ERP'),
 ('panel', N'ERP系统集成',     'vi',    N'Tích hợp ERP'),
 ('panel', N'ERP系统集成',     'th',    N'การเชื่อมต่อ ERP');

DECLARE @fl TABLE (ref_key nvarchar(120), en nvarchar(120), ja nvarchar(200), tw nvarchar(120));
INSERT INTO @fl (ref_key, en, ja, tw) VALUES
 (N'方向', 'Direction', N'方向', N'方向'),
 (N'分类', 'Category', N'分類', N'分類'),
 (N'接口编码', 'Interface code', N'インターフェースコード', N'介面編碼'),
 (N'接口名称', 'Interface name', N'インターフェース名', N'介面名稱'),
 (N'提供方', 'Provider', N'提供元', N'提供方'),
 (N'接口地址', 'Endpoint', N'エンドポイント', N'介面位址'),
 (N'请求方式', 'Method', N'メソッド', N'請求方式'),
 (N'对应面板', 'MES panel', N'MESパネル', N'對應面板'),
 (N'目标对象', 'ERP object', N'ERP対象', N'目標對象'),
 (N'触发方式', 'Trigger', N'実行契機', N'觸發方式'),
 (N'启用', 'Enabled', N'有効', N'啟用'),
 (N'排序', 'Order', N'並び順', N'排序'),
 (N'说明', 'Notes', N'説明', N'說明'),
 (N'MES字段', 'MES field', N'MES項目', N'MES欄位'),
 (N'ERP字段', 'ERP field', N'ERP項目', N'ERP欄位'),
 (N'转换规则', 'Transform', N'変換ルール', N'轉換規則'),
 (N'是否必填', 'Required', N'必須', N'是否必填'),
 (N'映射层级', 'Level', N'階層', N'對應層級'),
 (N'设备编码', 'Equipment code', N'設備コード', N'設備編碼'),
 (N'设备名称', 'Equipment name', N'設備名', N'設備名稱'),
 (N'设备用途', 'Equipment role', N'設備の役割', N'設備用途'),
 (N'表头', 'Header', N'ヘッダー', N'表頭'),
 (N'明细', 'Details', N'明細', N'明細'),
 (N'档案', 'Archive', N'マスタ', N'檔案'),
 (N'基础资料', 'Master data', N'基本情報', N'基礎資料'),
 (N'单据', 'Documents', N'伝票', N'單據'),
 (N'设备', 'Equipment', N'設備', N'設備'),
 (N'导入', 'Import', N'インポート', N'匯入'),
 (N'转出', 'Export', N'エクスポート', N'轉出');
INSERT INTO @t (scope, ref_key, locale, text)
SELECT 'field', f.ref_key, 'en', f.en FROM @fl f;
INSERT INTO @t (scope, ref_key, locale, text)
SELECT 'field', f.ref_key, 'ja', f.ja FROM @fl f;
INSERT INTO @t (scope, ref_key, locale, text)
SELECT 'field', f.ref_key, 'zh-TW', f.tw FROM @fl f;

INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT t.scope, t.ref_key, t.locale, t.text, 'manual'
  FROM @t t
 WHERE NOT EXISTS (SELECT 1 FROM yj_translation x
                    WHERE x.scope = t.scope AND x.ref_key = t.ref_key AND x.locale = t.locale);
PRINT N'  F. 多语言词条';
GO

/* ══════════════════════ 自检 ══════════════════════ */
DECLARE @apiN int, @impN int, @expN int, @fieldN int, @devN int, @missingDev int;
SELECT @apiN = COUNT(*), @impN = SUM(CASE WHEN 方向 = N'导入' THEN 1 ELSE 0 END),
       @expN = SUM(CASE WHEN 方向 = N'转出' THEN 1 ELSE 0 END)
  FROM erp_integ_api WHERE ISNULL(asp_cancel, N'N') <> N'Y';
SELECT @fieldN = COUNT(*) FROM erp_integ_field WHERE ISNULL(asp_cancel, N'N') <> N'Y';
SELECT @devN = COUNT(*) FROM erp_integ_device WHERE ISNULL(asp_cancel, N'N') <> N'Y';
SELECT @missingDev = COUNT(*) FROM erp_integ_device d
 WHERE ISNULL(d.asp_cancel, N'N') <> N'Y'
   AND NOT EXISTS (SELECT 1 FROM bs_equip e WHERE e.设备编码 = d.设备编码);
SELECT @apiN AS 接口数, @impN AS 导入数, @expN AS 转出数, @fieldN AS 字段映射数,
       @devN AS 设备绑定数, @missingDev AS 设备档案缺失数;
IF @apiN <> 23 OR @fieldN < 150 OR @missingDev <> 0
    RAISERROR(N'ERP集成配置种子不完整(期望 23 个接口 / ≥150 行映射 / 设备档案全命中)', 16, 1);
PRINT N'== migrate-erp-integ-config-20261018 完成 ==';
GO
