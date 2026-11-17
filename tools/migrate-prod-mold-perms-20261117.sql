/* ============================================================================
 * migrate-prod-mold-perms-20261117.sql —— 生产模具表（PROD_MOLD）补齐角色权限行
 * ----------------------------------------------------------------------------
 * 用户口径（2026-11-17，Excel 跟踪表 #7 第 2 条）：
 *   「相关账户没有模具尺寸表的权限」「模具尺寸表权限」
 *   （追问确认：指的就是要把 PROD_MOLD 的权限给角色勾上）
 *
 * 实测缺口（本地 HSDZ_MES，yj_role 共 7 个角色）：
 *   role 1 管理员      view,query    ✓
 *   role 2 普通用户     view,query    ✓
 *   role 3 文件负责人    (无行)        ✗ ← 缺失
 *   role 4 研发审核     view,query    ✓
 *   role 5 DBG2        view,query    ✓
 *   role 6/7 自动化角色  (无行)        ✗ ← 缺失
 *
 * 对照同族面板：RD_* 各面板无一例外都是 **7 个角色全部 view,query**
 * （见 yj_role_panel 里 RD_ALKALINE / RD_ANTIBACT 等）。PROD_MOLD 是复刻
 * rd_sinter_tolerance（烧结尺寸表）的维护表，权限形态本应与它们一致。
 *
 * 本脚本只补 **缺行**（不覆盖已存在的 perms，避免把管理员手工调过的权限刷回去）。
 * 补的是 view,query（查看 + 查询）：
 *   · archive 维护表的**写操作**服务端真闸门是 requireAdmin（G5，见 PanelConfigService
 *     buildArchiveConfig 注释），故 view,query 就足够让业务看到数据；
 *   · 需要让某个角色直接改维护表时，在「组织架构 → 角色权限」里再勾写动作，脚本不猜。
 *
 * 幂等：NOT EXISTS 判重；重复执行 0 行。
 * 两账套都执行（先正式 HSDZ_MES、后 HSDZ_MES_TEST）。
 * ========================================================================== */

SET NOCOUNT ON;

/* ---------- 自检：面板与表必须在册（否则说明 PROD_MOLD 没建，先跑 migrate-prod-mold-panel-20261030.sql） ---------- */
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = N'PROD_MOLD')
    RAISERROR(N'[prod-mold-perms] 面板 PROD_MOLD 不存在，请先执行 tools/migrate-prod-mold-panel-20261030.sql', 16, 1);
GO

/* ---------- 补权限行：所有角色 × 缺失的才插 ---------- */
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms)
SELECT r.id, N'PROD_MOLD', N'N', N'view,query'
FROM yj_role r
WHERE NOT EXISTS (SELECT 1 FROM yj_role_panel p
                  WHERE p.role_id = r.id AND p.panel_code = N'PROD_MOLD');
PRINT N'[prod-mold-perms] 新增权限行 = ' + CAST(@@ROWCOUNT AS nvarchar(10));
GO

/* ---------- 自检：角色数 = 权限行数 ---------- */
DECLARE @roles INT, @rows INT;
SELECT @roles = COUNT(*) FROM yj_role;
SELECT @rows  = COUNT(*) FROM yj_role_panel WHERE panel_code = N'PROD_MOLD';
PRINT N'[prod-mold-perms] 角色 ' + CAST(@roles AS nvarchar(10))
    + N' 个 / PROD_MOLD 权限行 ' + CAST(@rows AS nvarchar(10)) + N' 个';
IF @rows < @roles
    RAISERROR(N'[prod-mold-perms] 仍有角色没有 PROD_MOLD 权限行，组织架构里会勾不到', 16, 1);
GO