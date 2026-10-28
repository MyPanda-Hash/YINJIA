/* ═══════════════════════════════════════════════════════════════════════════════
   yj_panel.module_group: 'WMS管理系统' → 'WMS管理'
   (2026-10-20 用户口径:「把WMS管理系统改为WMS管理」)

   【范围】module_group 是**分组显示值**(报表/权限矩阵/菜单分组都用它),两账套各 35 张面板
   带这个值。改名要**代码常量与库侧值同步改**,否则:
     · 菜单显示「WMS管理」而报表分组仍按「WMS管理系统」→ 同一组变两个分组头;
     · ReportService 的旧名映射表(库存管理 → …)与新名对不上 → 报表归组错位。

   【同批代码改动】frontend/src/business/menus.js(一级目录 title)、
     backend PagePanelRegistry / ReportService 的常量与映射、i18n 8 语言词条、menus.test.js 断言。

   【幂等】只更新旧值行;重跑时旧值已 0 行 ⇒ 影响 0 行。末尾自检残留必须为 0。
   ═══════════════════════════════════════════════════════════════════════════════ */
SET NOCOUNT ON;
PRINT N'== yj_panel.module_group: WMS管理系统 → WMS管理 ==';

DECLARE @before int = (SELECT COUNT(1) FROM yj_panel WHERE module_group = N'WMS管理系统');
PRINT N'  改前带旧名 = ' + CAST(@before AS nvarchar(10)) + N' 张';

IF @before > 0
BEGIN
    UPDATE yj_panel SET module_group = N'WMS管理' WHERE module_group = N'WMS管理系统';
    PRINT N'  [OK] 已改名 ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 张';
END
ELSE
    PRINT N'  [SKIP] 已无旧名行(幂等重跑)';

/* ── 自检:旧名残留必须 0,新名必须 >0 ── */
DECLARE @left int = (SELECT COUNT(1) FROM yj_panel WHERE module_group = N'WMS管理系统');
DECLARE @now int = (SELECT COUNT(1) FROM yj_panel WHERE module_group = N'WMS管理');
IF @left <> 0
BEGIN
    DECLARE @msg nvarchar(200) = N'[FAIL] 旧名残留 ' + CAST(@left AS nvarchar(10)) + N' 张';
    RAISERROR(@msg, 16, 1);
    RETURN;
END
PRINT N'  [自检] 旧名残留 0,新名 = ' + CAST(@now AS nvarchar(10)) + N' 张 ✓';
PRINT N'== 完成 ==';
