/* ============================================================================
 * migrate-role-perms-20261117.sql —— 补三个面板的角色权限行
 * ----------------------------------------------------------------------------
 * 用户口径（2026-11-17）：「勾 3 个角色权限」——
 *   ① 内部开发样品申请单 RD_SAMPLE_INT
 *   ② 首件检验单 QC_FIRST_INSP
 *   ③ 外部开发样品申请单 RD_SAMPLE_EXT
 *
 * 生产实测缺口（yj_role 共 20 个角色）：
 *   RD_SAMPLE_INT   只有 4 个角色有行（1 管理员 / 2 普通用户 / 1025 / 1026）⇒ **16 个角色看不到这张单**
 *   QC_FIRST_INSP   10 个角色有行                              ⇒ 10 个角色看不到
 *   RD_SAMPLE_EXT   只有 4 个角色有行                          ⇒ 16 个角色看不到
 *
 * 用户原话（Excel #4）：「目前仅刘磊和系统管理员有权限，**需要先打开全部人员的
 *   写样品申请单权限和查阅**」；Excel #11：「账户无首件表权限」。
 *
 * 补的值 = `view,query,add,modify`（与既有「普通用户」角色 2 的基线逐字一致）：
 *   · view/query = 能看见、能查；
 *   · add        = 能在月度单下面新增自己那行；
 *   · modify     = 能改**自己那行**（行级归属由 ButtonService.applySampleIntRowRules 在服务端强制，
 *                  别人的行会被原值回写，不会因为勾了 modify 就改得动别人）；
 *   · **不给** audit / del / edit_others / view_all —— 这些是管理动作，仍只属于管理员与
 *     文档管理人（刘磊 liulei = 角色 1025，实测已具备 view_all + edit_others）。
 *
 * ⚠ 只插**缺行**，不覆盖已有行：已存在的 perms 是管理员在组织架构里手工调过的，
 *   脚本不去猜也不去刷（若哪天要收回权限，改这里会把人家的配置冲掉）。
 *
 * 幂等：NOT EXISTS 判重；重复执行 0 行。
 * 两账套都执行（先正式 HSDZ_MES、后 HSDZ_MES_TEST）。
 * ========================================================================== */

SET NOCOUNT ON;

/* ---------- 自检：三个面板必须在册 ---------- */
IF (SELECT COUNT(*) FROM yj_panel WHERE panel_code IN (N'RD_SAMPLE_INT', N'QC_FIRST_INSP', N'RD_SAMPLE_EXT')) < 3
    RAISERROR(N'[role-perms] 三个面板未全部登记，先确认 yj_panel', 16, 1);
GO

/* ---------- ① 内部开发样品申请单 ---------- */
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms)
SELECT r.id, N'RD_SAMPLE_INT', N'N', N'view,query,add,modify'
FROM yj_role r
WHERE NOT EXISTS (SELECT 1 FROM yj_role_panel p
                  WHERE p.role_id = r.id AND p.panel_code = N'RD_SAMPLE_INT');
PRINT N'[role-perms] RD_SAMPLE_INT   新增 = ' + CAST(@@ROWCOUNT AS nvarchar(10));
GO

/* ---------- ② 首件检验单 ---------- */
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms)
SELECT r.id, N'QC_FIRST_INSP', N'N', N'view,query,add,modify'
FROM yj_role r
WHERE NOT EXISTS (SELECT 1 FROM yj_role_panel p
                  WHERE p.role_id = r.id AND p.panel_code = N'QC_FIRST_INSP');
PRINT N'[role-perms] QC_FIRST_INSP   新增 = ' + CAST(@@ROWCOUNT AS nvarchar(10));
GO

/* ---------- ③ 外部开发样品申请单（不含 view_all：全局可见仍只给管理员/文档管理人） ---------- */
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms)
SELECT r.id, N'RD_SAMPLE_EXT', N'N', N'view,query,add,modify'
FROM yj_role r
WHERE NOT EXISTS (SELECT 1 FROM yj_role_panel p
                  WHERE p.role_id = r.id AND p.panel_code = N'RD_SAMPLE_EXT');
PRINT N'[role-perms] RD_SAMPLE_EXT   新增 = ' + CAST(@@ROWCOUNT AS nvarchar(10));
GO

/* ---------- 自检：三个面板都要「角色数 = 权限行数」 ---------- */
DECLARE @roles INT;
SELECT @roles = COUNT(*) FROM yj_role;
DECLARE @a INT, @b INT, @c INT;
SELECT @a = COUNT(*) FROM yj_role_panel WHERE panel_code = N'RD_SAMPLE_INT';
SELECT @b = COUNT(*) FROM yj_role_panel WHERE panel_code = N'QC_FIRST_INSP';
SELECT @c = COUNT(*) FROM yj_role_panel WHERE panel_code = N'RD_SAMPLE_EXT';
PRINT N'[role-perms] 角色 ' + CAST(@roles AS nvarchar(10))
    + N' → RD_SAMPLE_INT ' + CAST(@a AS nvarchar(10))
    + N' / QC_FIRST_INSP ' + CAST(@b AS nvarchar(10))
    + N' / RD_SAMPLE_EXT ' + CAST(@c AS nvarchar(10));
IF @a < @roles OR @b < @roles OR @c < @roles
    RAISERROR(N'[role-perms] 仍有角色缺权限行，组织架构里会勾不到', 16, 1);
GO