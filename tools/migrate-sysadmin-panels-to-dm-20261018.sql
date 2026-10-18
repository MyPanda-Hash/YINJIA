/* migrate-sysadmin-panels-to-dm-20261018.sql — 系统管理平台 32 张业务面板迁入「数据建模」

  【用户口径 2026-10-18】「把现在系统管理平台里面的面板全部挪到数据建模,然后把这个做成入口
    写到系统管理平台里面」⇒ ① 本脚本把 yj_panel.module_group 由「系统管理平台」改为「数据建模」(32 张);
    ② 导航把原 base 下的四组(基础数据/物料及价格/生产/财务)整组移到一级「数据建模」(frontend/src/business/menus.js);
    ③ 「系统管理平台」只留系统功能入口页 /sys/console(账号信息/修改密码/界面设置/工作台设置/换肤
    + 组织架构/使用权限查看)。
  【为什么不改 category】category 是历史小节名(基础数据/基础设置/…),权限矩阵与导航都不按它分组
    (口径见 migrate-role-panel-modules-20261018.sql:分组以菜单一级模块为准)。
  【权限影响】查库实测 role 1/2/4/5 对这 32 张均已 grants=32 / view=32 ⇒ **只改分组名不扩权**;
    数据建模原有 4 张(FIELDMGR/ZDGL/ERPLG/ERPLG_ROW)对非管理员已是只读。
    ⚠ ReportService.NAV_GROUP 的历史别名(基础数据/物料及价格/财务/…)同步改指向「数据建模」,
      否则权限矩阵会出现一个没有面板的空分组「系统管理平台」。
  【幂等】按当前 group 值匹配,重跑 = 0 行(已全部迁走)。
  【顺序】必须排在 migrate-role-panel-modules-20261018.sql **之后**(那个脚本会把 32 张写回「系统管理平台」,
    全链重放时本脚本在后才能收敛)。两账套均执行:先 HSDZ_MES,后 HSDZ_MES_TEST。
*/
SET NOCOUNT ON;
GO
IF DB_NAME() = N'master' USE HSDZ_MES;
GO

DECLARE @moved int;

UPDATE yj_panel
   SET module_group = N'数据建模'
 WHERE module_group = N'系统管理平台';
SET @moved = @@ROWCOUNT;

DECLARE @db sysname = DB_NAME();
RAISERROR(N'[OK] %s 系统管理平台→数据建模 迁移 %d 张面板', 10, 1, @db, @moved);
GO

/* 自检:系统管理平台 应为 0 张;数据建模 = 36 张(既有 4 + 迁入 32),既有 4 张一张不少 */
DECLARE @left int = (SELECT COUNT(*) FROM yj_panel WHERE module_group = N'系统管理平台');
DECLARE @dm   int = (SELECT COUNT(*) FROM yj_panel WHERE module_group = N'数据建模');
DECLARE @keep int = (SELECT COUNT(*) FROM yj_panel WHERE module_group = N'数据建模'
                       AND panel_code IN (N'FIELDMGR', N'ZDGL', N'ERPLG', N'ERPLG_ROW'));
IF @left <> 0 RAISERROR(N'[FAIL] 系统管理平台 仍残留 %d 张面板', 16, 1, @left);
IF @dm <> 36 RAISERROR(N'[FAIL] 数据建模 共 %d 张(期望 36)', 16, 1, @dm);
IF @keep <> 4 RAISERROR(N'[FAIL] 数据建模原有 4 张只剩 %d 张', 16, 1, @keep);
IF @left = 0 AND @dm = 36 AND @keep = 4 PRINT N'[OK] 32 张已全部归入数据建模(共 36 张)';
GO
