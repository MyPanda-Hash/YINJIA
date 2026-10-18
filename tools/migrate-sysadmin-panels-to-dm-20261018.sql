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

/* 自检(2026-10-20 修正:原判据「数据建模 = 36、既有 4 张全在数据建模」已过时)
 *
 * 为什么改:本脚本写于 2026-10-18 早些时候,当时「数据建模」= 既有 4 张
 *   (FIELDMGR/ZDGL/ERPLG/ERPLG_ROW) + 迁入 32 张 = 36。
 *   而同一天更晚落地的 migrate-erp-integ-config-20261018.sql 把 **ERPLG / ERPLG_ROW
 *   改归「ERP系统集成」**(ERP 集成页需要它们在那个导航组下)。于是:
 *     · 正式库:数据建模 = 34(ERPLG/ERPLG_ROW 已挪走) ⇒ 旧判据 36 恒失败;
 *     · 本脚本自检一失败,DbSync 就 break ⇒ **它后面的 5 个迁移永远轮不到执行**:
 *       migrate-dc-platform / migrate-dc-gateway-apikey / migrate-proc-process-refs /
 *       migrate-proc-process-samples / migrate-stock-balance-warn
 *       (实测:数采平台 bs_dc_* 8 张表全缺 ⇒ /api/dc/stats 直接 500)。
 *   而且本脚本从未成功登记 ⇒ 每次启动都重跑、每次都红。
 *
 * 现在的判据(对两账套、对「ERP 迁移是否已跑」都成立):
 *   ① 系统管理平台无残留;
 *   ② 既有 4 张一张不丢(落在「数据建模」或「ERP系统集成」都算,取决于 ERPLG 迁移跑没跑);
 *   ③ 迁入的 32 张仍在「数据建模」里(用 @dm - 既有面板在该组的数量反推)。
 */
DECLARE @left int = (SELECT COUNT(*) FROM yj_panel WHERE module_group = N'系统管理平台');
DECLARE @keepDm int = (SELECT COUNT(*) FROM yj_panel WHERE module_group = N'数据建模'
                          AND panel_code IN (N'FIELDMGR', N'ZDGL', N'ERPLG', N'ERPLG_ROW'));
DECLARE @keepErp int = (SELECT COUNT(*) FROM yj_panel WHERE module_group = N'ERP系统集成'
                          AND panel_code IN (N'FIELDMGR', N'ZDGL', N'ERPLG', N'ERPLG_ROW'));
DECLARE @dm int = (SELECT COUNT(*) FROM yj_panel WHERE module_group = N'数据建模');
DECLARE @movedInDm int = @dm - @keepDm;   -- 应恒为 32(迁入的那批)
-- ⚠ RAISERROR 的替换参数**只能是常量或变量,不能是表达式**:直接写 `@keepDm + @keepErp`
--   会报「“+”附近有语法错误」(2026-10-20 实测)。先算进变量再传。
DECLARE @keepAll int = @keepDm + @keepErp;

IF @left <> 0 RAISERROR(N'[FAIL] 系统管理平台 仍残留 %d 张面板', 16, 1, @left);
IF @keepAll <> 4
    RAISERROR(N'[FAIL] 既有 4 张(字段管理/数据字典/导入日志/日志明细)只剩 %d 张(数据建模 %d + ERP系统集成 %d)',
              16, 1, @keepAll, @keepDm, @keepErp);
IF @movedInDm <> 32
    RAISERROR(N'[FAIL] 迁入数据建模的面板共 %d 张(期望 32):数据建模总计 %d,其中既有 %d',
              16, 1, @movedInDm, @dm, @keepDm);
IF @left = 0 AND @keepAll = 4 AND @movedInDm = 32
    PRINT N'[OK] 32 张已全部归入数据建模;数据建模共 ' + CAST(@dm AS nvarchar(10))
        + N' 张(既有字段管理/数据字典 + 迁入 32;ERPLG/ERPLG_ROW 归 ERP系统集成)';
GO
