/* migrate-role-panel-modules-20261018.sql — 面板 module_group 归一到当前导航一级模块

   【用户口径 2026-10-18】给组织架构·角色面板权限「对照现在的模块分类以及对应面板权限」更新。
   【为什么改】2026-10-18 导航改版后一级模块 = 我的桌面 / 研发管理 / 智能供应链 / 库存管理 /
     生产制造 / 品质管理 / 数据建模 / 系统管理平台;而 yj_panel.module_group 仍是历史碎值
     (库存核算 27 / 基础设置 25 / 基础资料 4 / 订单管理 2 / 采购管理 1 / 生产管理 1 / 委外加工 1 …),
     权限矩阵只能靠 ReportService.navGroup 显示层归并。本次把库里的值也统一,
     让「矩阵分组 = 菜单一级模块」成为唯一口径(报表 navGroup / 同模块读放行吃到同一份值)。
   【归口规则】菜单内面板按其一级模块;23 张菜单外面板按业务域:
     采购单/客户订单→智能供应链;工序派工单族/生产工单族/排单计划/样品申请/委外→生产制造;
     客户分类/商品分类/供应商分类/往来单位/检验项目/检验方案/烧结尺寸表→系统管理平台;
     ERP导入明细→数据建模;组装BOM/成型配方(休眠)→研发管理;库存状况→库存管理。
   【本批】改动 69 张,分布 {"库存管理":28,"智能供应链":3,"系统管理平台":32,"生产制造":1,"品质管理":4,"数据建模":1}。
   【幂等】只更新与目标值不同的行;两账套均执行。
*/
SET NOCOUNT ON;
GO
IF DB_NAME() = N'master' USE HSDZ_MES;
GO
DECLARE @m TABLE (panel_code varchar(40) PRIMARY KEY, module_group nvarchar(50) NOT NULL);
INSERT INTO @m (panel_code, module_group) VALUES
    (N'BARCODE_FIN', N'库存管理'),
    (N'BARCODE_MAT', N'库存管理'),
    (N'BARCODE_WIP', N'库存管理'),
    (N'CGD', N'智能供应链'),
    (N'CUR', N'系统管理平台'),
    (N'CUSGRP', N'系统管理平台'),
    (N'DEPT', N'系统管理平台'),
    (N'EMP', N'系统管理平台'),
    (N'EQUIP', N'系统管理平台'),
    (N'FIN_ACC', N'系统管理平台'),
    (N'FIN_EXP', N'系统管理平台'),
    (N'FIN_TAX', N'系统管理平台'),
    (N'FINISH_IN', N'库存管理'),
    (N'FINISH_IN_DETAIL', N'库存管理'),
    (N'FINISH_IN_STATS', N'库存管理'),
    (N'GFDA', N'系统管理平台'),
    (N'INV', N'系统管理平台'),
    (N'INV_PRICE', N'系统管理平台'),
    (N'KHDA', N'系统管理平台'),
    (N'KHDD', N'智能供应链'),
    (N'MATERIAL_OUT', N'库存管理'),
    (N'MATERIAL_OUT_DETAIL', N'库存管理'),
    (N'MATERIAL_OUT_STATS', N'库存管理'),
    (N'MATGRP', N'系统管理平台'),
    (N'OP', N'系统管理平台'),
    (N'OP_TIME', N'系统管理平台'),
    (N'OTHER_IN', N'库存管理'),
    (N'OTHER_IN_DETAIL', N'库存管理'),
    (N'OTHER_IN_STATS', N'库存管理'),
    (N'OTHER_OUT', N'库存管理'),
    (N'OTHER_OUT_DETAIL', N'库存管理'),
    (N'OTHER_OUT_STATS', N'库存管理'),
    (N'OUTSOURCE_ORDER', N'生产制造'),
    (N'PARTNER', N'系统管理平台'),
    (N'PROD_LINE', N'系统管理平台'),
    (N'PROJ', N'系统管理平台'),
    (N'PU_ORDER', N'智能供应链'),
    (N'PURCHASE_IN', N'库存管理'),
    (N'PURCHASE_IN_DETAIL', N'库存管理'),
    (N'PURCHASE_IN_STATS', N'库存管理'),
    (N'QC_ASM_INSP', N'品质管理'),
    (N'QC_FIRST_INSP', N'品质管理'),
    (N'QC_INSP', N'品质管理'),
    (N'QC_ITEM', N'系统管理平台'),
    (N'QC_PLAN', N'系统管理平台'),
    (N'QC_PROC_INSP', N'品质管理'),
    (N'QC_RECV', N'库存管理'),
    (N'QC_RETURN', N'库存管理'),
    (N'RD_SINTER_TOL', N'系统管理平台'),
    (N'REGION', N'系统管理平台'),
    (N'REJECT', N'系统管理平台'),
    (N'ROUTE', N'系统管理平台'),
    (N'SALE_OUT', N'库存管理'),
    (N'SALE_OUT_DETAIL', N'库存管理'),
    (N'SALE_OUT_STATS', N'库存管理'),
    (N'SETTLE', N'系统管理平台'),
    (N'STOCK_BALANCE', N'库存管理'),
    (N'STOCK_DETAIL', N'库存管理'),
    (N'STOCK_LEDGER', N'库存管理'),
    (N'STOCK_STATUS', N'库存管理'),
    (N'STOCK_SUMMARY', N'库存管理'),
    (N'SUPGRP', N'系统管理平台'),
    (N'TEAM', N'系统管理平台'),
    (N'UOM', N'系统管理平台'),
    (N'WC', N'系统管理平台'),
    (N'WH', N'系统管理平台'),
    (N'WHLOC', N'系统管理平台'),
    (N'WLBOM', N'系统管理平台'),
    (N'ZDGL', N'数据建模');

UPDATE p SET module_group = m.module_group
  FROM yj_panel p JOIN @m m ON m.panel_code = p.panel_code
 WHERE ISNULL(p.module_group, N'') <> m.module_group;

DECLARE @db sysname = DB_NAME();
RAISERROR(N'[OK] %s 面板 module_group 归一到导航一级模块', 10, 1, @db);
GO

DECLARE @bad int = (SELECT COUNT(*) FROM yj_panel WHERE module_group IN
   (N'库存核算', N'库存报表', N'基础设置', N'基础资料', N'基础数据', N'采购管理', N'订单管理',
    N'生产管理', N'委外加工', N'销售管理', N'物料及价格', N'财务管理', N'设备管理', N'条码管理'));
IF @bad > 0 RAISERROR(N'[FAIL] 仍有 %d 张面板是历史模块碎值', 16, 1, @bad);
ELSE PRINT N'[OK] 历史模块碎值已清零';
GO