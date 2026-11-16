/* migrate-sample-insp-module-20261116.sql(2026-11-16):「样品检验」从品质管理二级分组提升为一级模块
 *
 * 需求来源(用户 2026-11-16 口径):
 *   「样品检验需要单独放在外面的位置,相当于单独一个模块实现了。」
 *   同日追问确认:一级模块位置 = **紧跟「品质管理」下方**
 *   (侧栏顺序:… 生产过程 → 品质管理 → 样品检验 → 数据建模 …)。
 *
 * ⚠ 导航顺序本身由**前端硬编码** `frontend/src/business/menus.js` 决定(本次同批改,
 *   不是本脚本能搬的 —— 见 DbNormAudit 里那条历史备注「左侧导航是前端 menus.js 硬编码,
 *   改 yj_panel.category/module_group 不生效」)。本脚本只做**元数据口径对齐**:
 *   把两张面板的 `yj_panel.module_group` 从「品质管理」改为「样品检验」——
 *   这一列是「组织架构 → 角色与面板权限」矩阵的分组来源(SysAdminController.rolePanels
 *   → ReportService.navGroup),不改它的话,独立出来的一级模块在权限矩阵里仍挂在品质管理下,
 *   模块与权限两处口径会打架。后端 ReportService.NAV_GROUP_ORDER 同批补「样品检验」位置。
 *
 * 不动的:
 *   · yj_panel.category(是「单据/报表/基础档案」性质轴,不是导航分组;两张面板沿用原值);
 *   · 面板码 / 面板名 / 路由 / 字段 / 表结构 / 单号前缀 / 角色授权(yj_role_panel)—— 一个字节不动,
 *     权限仍按面板码走,已授权角色不受影响;
 *   · 物理数据。
 *
 * 幂等:UPDATE 带 `<> N'样品检验'` 窄条件;重复执行 = 0 行更新、自检照常通过。
 * 两账套执行(先正式 HSDZ_MES、后测试 HSDZ_MES_TEST),见 tools/db-migrations.txt。
 */

/* ============ A. 元数据:两张面板归入「样品检验」模块组 ============ */
UPDATE yj_panel
   SET module_group = N'样品检验'
 WHERE panel_code IN (N'SAMPLE_REG', N'INSP_COMMISSION')
   AND ISNULL(module_group, N'') <> N'样品检验';
GO

/* ============ B. 自检(缺一即 RAISERROR 16;DbSync 判失败且不写 yj_schema_log) ============ */
DECLARE @bad int = 0;
DECLARE @msg nvarchar(600) = N'';
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = N'SAMPLE_REG')
  BEGIN SET @bad += 1; SET @msg += N'缺 SAMPLE_REG 面板;'; END
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = N'INSP_COMMISSION')
  BEGIN SET @bad += 1; SET @msg += N'缺 INSP_COMMISSION 面板;'; END
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = N'SAMPLE_REG' AND module_group = N'样品检验')
  BEGIN SET @bad += 1; SET @msg += N'SAMPLE_REG 未归入样品检验;'; END
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = N'INSP_COMMISSION' AND module_group = N'样品检验')
  BEGIN SET @bad += 1; SET @msg += N'INSP_COMMISSION 未归入样品检验;'; END
/* 角色授权必须原样还在(搬模块不动权限):两张面板各自至少一条 view 授权 */
IF (SELECT COUNT(*) FROM yj_role_panel WHERE panel_code = N'SAMPLE_REG') = 0
  BEGIN SET @bad += 1; SET @msg += N'缺送样登记表角色授权;'; END
IF (SELECT COUNT(*) FROM yj_role_panel WHERE panel_code = N'INSP_COMMISSION') = 0
  BEGIN SET @bad += 1; SET @msg += N'缺检验委托单角色授权;'; END
/* 只动这两行:样品检验组内不得混入其它面板(防止误改扩散) */
IF (SELECT COUNT(*) FROM yj_panel WHERE module_group = N'样品检验') <> 2
  BEGIN SET @bad += 1; SET @msg += N'样品检验模块组面板数<>2;'; END
IF @bad > 0
  RAISERROR(N'样品检验模块迁移自检失败(缺面板/未归组/缺授权/组内混入):%s', 16, 1, @msg);
ELSE PRINT N'样品检验模块就绪(SAMPLE_REG / INSP_COMMISSION → module_group=样品检验;授权未动)';
GO
