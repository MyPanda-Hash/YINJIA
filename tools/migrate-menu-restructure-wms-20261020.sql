/* ============================================================
   migrate-menu-restructure-wms-20261020.sql
   导航改版 + 权限矩阵补面板(2026-10-20 用户口径,四件事)

   用户原话:「现在给组织架构的角色面板权限更新一下，现在少了几个面板，把库存管理名字改为
   WMS管理系统，把生产制造的生产计划和生产过程提成一级目录，生产制造这个一级目录不要了，
   把设备维护挪到系统管理平台」

   ① **库存管理 → WMS管理系统**:只改显示名(一级目录 code 仍 'inv')。
      库侧对应 `yj_panel.module_group`:N'库存管理' → N'WMS管理系统'。
      后端 `ReportService.navGroup` 把新旧两个值都映射到「WMS管理系统」,权限矩阵分组名跟着变。

   ② **「生产制造」拆成两个一级目录**:生产计划 / 生产过程(设备维护移走,见 ③)。
      库侧按面板码精确改分组(不按 module_group 粗改,避免把已下架残留面板带错):
        · 生产过程 10 张:WO_REPORT / WO_REPORT_LIST / WO_COMPLETION_LIST / PROD_ABN /
          DAY_REPORT / FEED_CONFIRM / MIX_RECORD / GRAN_RECORD / WH_RECORD / PACK_CONFIRM
        · 剩下的原「生产制造」组(WORK_ORDER_* / LINE_LOAD / MANU_* / WO_ORDER 等)归「生产计划」

   ③ **设备维护移进系统管理平台**:EQUIP_CHECK(设备点检记录)/ MAINT_PLAN(保养计划)
      module_group → N'系统管理平台'。面板码/权限词/路由一律不动,只换导航位置。

   ④ **补齐权限矩阵里缺的面板**(「少了几个面板」的口径):
      菜单里 8 个叶子没有面板码,其中 4 个是管理员专属系统页(系统管理/组织架构/使用权限查看/
      数据备份,`requireAdmin` 硬闸,本就不该进矩阵),真正缺的是这 4 个**面向所有人**的页面:
        · DC_CONFIG / DC_MONITOR / DC_STATS  —— 数采平台三页(设备配置管理 / 数据监控 / 状态统计)
        · BARCODE_SCAN_PICK                 —— 库存管理(现 WMS管理系统)·条码管理 → 扫码领料
      三者此前无面板码 ⇒ 权限矩阵里勾不到,且任何登录账号都能直接进(菜单隐藏只是显示层)。
      本脚本:
        · 往 `yj_role_panel` 补授权行 —— **凡现有角色**都给 view(+ query / 页面专属动作),
          口径 = 改前它们对所有人开放,补权是保持现状而不是收紧;管理员角色本来就是恒过,
          同步写行是为了矩阵界面上看得见、日后好逐项收权;
        · 往 `yj_translation` 补这 4 个面板名的 en 译名(AGENTS 多语言强制)。
      服务端闸门同批落地(不在本脚本):`DcController` 的 config/points/rules/monitor/stats
      加 `requirePanelView("DC_*")`;扫码领料的数据侧走通用面板引擎(闸门在 MATERIAL_OUT),
      本码只管「能不能进这个页面」。

   幂等:所有 UPDATE 带窄条件 + 行数守卫;授权/译名全部 IF NOT EXISTS。
   两账套均执行(HSDZ_MES 先、HSDZ_MES_TEST 后),已登记 tools/db-migrations.txt。
   ============================================================ */
SET NOCOUNT ON;
GO
IF DB_NAME() = N'master' USE HSDZ_MES;
GO

/* ---------- ① 库存管理 → WMS管理系统 ---------- */
DECLARE @inv int = 0;
UPDATE dbo.yj_panel SET module_group = N'WMS管理系统'
 WHERE module_group = N'库存管理';
SET @inv = @@ROWCOUNT;
PRINT N'[1] 库存管理 → WMS管理系统:改 ' + CAST(@inv AS nvarchar(10)) + N' 张面板';
GO

/* ---------- ② 生产过程 10 张 + 其余归生产计划 ---------- */
DECLARE @proc int = 0;
UPDATE dbo.yj_panel SET module_group = N'生产过程'
 WHERE panel_code IN (N'WO_REPORT', N'WO_REPORT_LIST', N'WO_COMPLETION_LIST', N'PROD_ABN',
                      N'DAY_REPORT', N'FEED_CONFIRM', N'MIX_RECORD', N'GRAN_RECORD',
                      N'WH_RECORD', N'PACK_CONFIRM');
SET @proc = @@ROWCOUNT;

/* ---------- ③ 设备维护 → 系统管理平台 ---------- */
DECLARE @dev int = 0;
UPDATE dbo.yj_panel SET module_group = N'系统管理平台'
 WHERE panel_code IN (N'EQUIP_CHECK', N'MAINT_PLAN');
SET @dev = @@ROWCOUNT;

/* ---------- ②b 原「生产制造」剩下的 → 生产计划 ---------- */
DECLARE @plan int = 0;
UPDATE dbo.yj_panel SET module_group = N'生产计划'
 WHERE module_group = N'生产制造';
SET @plan = @@ROWCOUNT;
PRINT N'[2] 生产制造拆分:生产过程 ' + CAST(@proc AS nvarchar(10))
      + N' 张 / 生产计划 ' + CAST(@plan AS nvarchar(10))
      + N' 张 / 设备维护迁系统管理平台 ' + CAST(@dev AS nvarchar(10)) + N' 张';
GO

/* ---------- ④ 补权限矩阵里缺的 4 个页面面板 ---------- */
/* 4-a 数采平台·设备配置管理:只要「能看/能查」,写操作仍由后端 requireAdmin 硬闸 */
INSERT INTO dbo.yj_role_panel (role_id, panel_code, can_approve, perms)
SELECT r.id, N'DC_CONFIG', 'N', N'view,query'
  FROM dbo.yj_role r
 WHERE NOT EXISTS (SELECT 1 FROM dbo.yj_role_panel x WHERE x.role_id = r.id AND x.panel_code = N'DC_CONFIG');
GO

/* 4-b 数采平台·数据监控:多一个 alarm(处理报警,车间任何人可认领) */
INSERT INTO dbo.yj_role_panel (role_id, panel_code, can_approve, perms)
SELECT r.id, N'DC_MONITOR', 'N', N'view,query,alarm'
  FROM dbo.yj_role r
 WHERE NOT EXISTS (SELECT 1 FROM dbo.yj_role_panel x WHERE x.role_id = r.id AND x.panel_code = N'DC_MONITOR');
GO

/* 4-c 数采平台·状态统计:只读 */
INSERT INTO dbo.yj_role_panel (role_id, panel_code, can_approve, perms)
SELECT r.id, N'DC_STATS', 'N', N'view,query'
  FROM dbo.yj_role r
 WHERE NOT EXISTS (SELECT 1 FROM dbo.yj_role_panel x WHERE x.role_id = r.id AND x.panel_code = N'DC_STATS');
GO

/* 4-d 扫码领料:view/query + pick(生成材料出库单草稿;真正落库仍受 MATERIAL_OUT 权限约束) */
INSERT INTO dbo.yj_role_panel (role_id, panel_code, can_approve, perms)
SELECT r.id, N'BARCODE_SCAN_PICK', 'N', N'view,query,pick'
  FROM dbo.yj_role r
 WHERE NOT EXISTS (SELECT 1 FROM dbo.yj_role_panel x WHERE x.role_id = r.id AND x.panel_code = N'BARCODE_SCAN_PICK');
GO

/* 4-e 面板名译名(AGENTS 多语言强制:页面级虚拟面板同样要 en 译名) */
IF NOT EXISTS (SELECT 1 FROM dbo.yj_translation WHERE scope = 'panel' AND ref_key = N'设备配置管理' AND locale = 'en')
  INSERT INTO dbo.yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'设备配置管理', 'en', N'Device Configuration', 'manual');
IF NOT EXISTS (SELECT 1 FROM dbo.yj_translation WHERE scope = 'panel' AND ref_key = N'数据监控' AND locale = 'en')
  INSERT INTO dbo.yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'数据监控', 'en', N'Data Monitor', 'manual');
IF NOT EXISTS (SELECT 1 FROM dbo.yj_translation WHERE scope = 'panel' AND ref_key = N'状态统计' AND locale = 'en')
  INSERT INTO dbo.yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'状态统计', 'en', N'Status Statistics', 'manual');
IF NOT EXISTS (SELECT 1 FROM dbo.yj_translation WHERE scope = 'panel' AND ref_key = N'扫码领料' AND locale = 'en')
  INSERT INTO dbo.yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'扫码领料', 'en', N'Scan Picking', 'manual');
GO

/* ---------- 自检 ---------- */
DECLARE @bad int = (SELECT COUNT(*) FROM dbo.yj_panel WHERE module_group = N'库存管理');
IF @bad <> 0 RAISERROR(N'[FAIL] 仍有 %d 张面板挂在旧分组「库存管理」', 16, 1, @bad);

DECLARE @bad2 int = (SELECT COUNT(*) FROM dbo.yj_panel WHERE module_group = N'生产制造');
IF @bad2 <> 0 RAISERROR(N'[FAIL] 仍有 %d 张面板挂在已撤销分组「生产制造」', 16, 1, @bad2);

DECLARE @procCnt int = (SELECT COUNT(*) FROM dbo.yj_panel WHERE module_group = N'生产过程');
IF @procCnt < 10 RAISERROR(N'[FAIL] 「生产过程」分组应至少 10 张,实际 %d', 16, 1, @procCnt);

DECLARE @devCnt int = (SELECT COUNT(*) FROM dbo.yj_panel WHERE panel_code IN (N'EQUIP_CHECK', N'MAINT_PLAN') AND module_group = N'系统管理平台');
IF @devCnt <> 2 RAISERROR(N'[FAIL] 设备维护应有 2 张在「系统管理平台」,实际 %d', 16, 1, @devCnt);

DECLARE @roleCnt int = (SELECT COUNT(*) FROM dbo.yj_role);
DECLARE @miss1 int = (SELECT COUNT(*) FROM dbo.yj_role r WHERE NOT EXISTS (SELECT 1 FROM dbo.yj_role_panel x WHERE x.role_id = r.id AND x.panel_code = N'DC_CONFIG'));
DECLARE @miss2 int = (SELECT COUNT(*) FROM dbo.yj_role r WHERE NOT EXISTS (SELECT 1 FROM dbo.yj_role_panel x WHERE x.role_id = r.id AND x.panel_code = N'DC_MONITOR'));
DECLARE @miss3 int = (SELECT COUNT(*) FROM dbo.yj_role r WHERE NOT EXISTS (SELECT 1 FROM dbo.yj_role_panel x WHERE x.role_id = r.id AND x.panel_code = N'DC_STATS'));
DECLARE @miss4 int = (SELECT COUNT(*) FROM dbo.yj_role r WHERE NOT EXISTS (SELECT 1 FROM dbo.yj_role_panel x WHERE x.role_id = r.id AND x.panel_code = N'BARCODE_SCAN_PICK'));
IF @miss1 + @miss2 + @miss3 + @miss4 <> 0
  RAISERROR(N'[FAIL] 4 个新页面面板仍有角色未授权(缺 DC_CONFIG %d / DC_MONITOR %d / DC_STATS %d / SCAN_PICK %d,角色共 %d)',
            16, 1, @miss1, @miss2, @miss3, @miss4, @roleCnt);

DECLARE @tr int = (SELECT COUNT(*) FROM dbo.yj_translation
                    WHERE scope = 'panel' AND locale = 'en'
                      AND ref_key IN (N'设备配置管理', N'数据监控', N'状态统计', N'扫码领料'));
IF @tr <> 4 RAISERROR(N'[FAIL] 4 个页面面板的 en 译名只补了 %d 条', 16, 1, @tr);

RAISERROR(N'[OK] 导航改版完成:库存管理→WMS管理系统、生产制造拆为 生产计划/生产过程、设备维护归系统管理平台;4 个页面面板已补授权(%d 个角色)与 en 译名',
          10, 1, @roleCnt) WITH NOWAIT;
GO
