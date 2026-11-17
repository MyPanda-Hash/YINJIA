/* ============================================================================
 * migrate-spec-approve-perm-20261117.sql —— 恢复「规格书批准」按钮（补 specapprove 词）
 * ----------------------------------------------------------------------------
 * 用户报障（2026-11-17）：
 *   「产品文件列表的所有文件完成后，规格书的批准人（冯敏）自动签核/生成日期
 *     —— 在文件列表有一个批准点击这个功能不见了」
 *
 * 排查结论：**前端按钮与后端接口都还在，是权限词从未授予任何人**。
 *   · 前端 ProdDocListSheet.vue：`canApprove(c)` 要求
 *       c.panelCode === 'RD_SPEC_DOC' 且 当前用户 perms 含 specapprove（管理员恒放行）；
 *   · 后端 PxController：GET/POST 批准接口闸门 = requireAnyPerm('RD_SPEC_DOC','规格书批准','specapprove')；
 *   · 生产实测：yj_role_panel 里 panel_code='RD_SPEC_DOC' 的 10 行 perms **无一行含 specapprove**
 *     ⇒ 除管理员（isAdmin 恒放行）外，任何人看不到那颗按钮。
 *
 * 为什么之前"感觉有过"：11-06 上线时只有管理员在测（管理员恒放行），
 * 一旦换成业务账号（冯敏）就整颗按钮消失 —— 典型「只在管理员账号上验收」的漏网。
 *
 * 授予对象：角色 **1025**（冯敏 fengmin / 刘磊 liulei / 柴善银 chaishanyin 等研发部账号所在角色）。
 *
 * ⚠ 必须知道的口径限制：yj_user.role_id 是**单值**（一个账号一个角色），
 *   无法把「冯敏一个人」单独拆出来授权 —— 要么给整个 1025 角色，要么新建一个角色再把冯敏挪过去
 *   （那会连带丢掉他在 1025 的其余权限）。故本轮按用户口径「批准人是冯敏」给 1025 整个角色，
 *   该角色内其他人也会看到这颗按钮。若日后要收窄，需要先加「账号级权限覆盖」能力，不能靠此脚本。
 *
 * 幂等：只在缺 specapprove 时追加（用 CHARINDEX 判断），重复执行 0 行。
 * 两账套都执行（先正式 HSDZ_MES、后 HSDZ_MES_TEST）。
 * ========================================================================== */

SET NOCOUNT ON;

/* ---------- 目标角色：**按姓名动态解析**（不写死角色 id，三账套都能跑） ----------
 * 生产：冯敏 = fengmin = role_id 1025（同角色还有 刘磊/柴善银 等研发部账号）。
 * 本地副本没有这个账号 ⇒ 下面的自检会明确报错，而不是静默 0 行（静默才是最危险的）。
 */
IF OBJECT_ID('tempdb..#target') IS NOT NULL DROP TABLE #target;
CREATE TABLE #target (role_id INT PRIMARY KEY);
INSERT INTO #target (role_id)
SELECT DISTINCT u.role_id
FROM yj_user u
WHERE ISNULL(u.role_id, 0) > 0
  AND (u.real_name LIKE N'%冯敏%' OR u.username = N'fengmin');

DECLARE @nTarget INT = (SELECT COUNT(*) FROM #target);
PRINT N'[spec-approve] 解析到目标角色数 = ' + CAST(@nTarget AS nvarchar(10));

/* ---------- 自检：面板在册 + 目标角色非空 ---------- */
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = N'RD_SPEC_DOC')
    RAISERROR(N'[spec-approve] 面板 RD_SPEC_DOC 不存在', 16, 1);
IF @nTarget = 0
    RAISERROR(N'[spec-approve] 找不到「冯敏」账号（real_name=冯敏 / username=fengmin）⇒ 无法确定批准人角色', 16, 1);
GO

/* ---------- ① 目标角色还没有 RD_SPEC_DOC 权限行：插一行（基础权限 + specapprove） ---------- */
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms)
SELECT t.role_id, N'RD_SPEC_DOC', N'N',
       N'view,query,add,modify,modlog,del,export,field,specapprove'
FROM #target t
WHERE NOT EXISTS (SELECT 1 FROM yj_role_panel p
                  WHERE p.role_id = t.role_id AND p.panel_code = N'RD_SPEC_DOC');
PRINT N'[spec-approve] 新建权限行 = ' + CAST(@@ROWCOUNT AS nvarchar(10));
GO

/* ---------- ② 已有行但缺 specapprove：追加（不覆盖其余词） ---------- */
UPDATE p
   SET p.perms = ISNULL(p.perms, N'') + N',specapprove'
  FROM yj_role_panel p
  JOIN #target t ON t.role_id = p.role_id
 WHERE p.panel_code = N'RD_SPEC_DOC'
   AND ISNULL(p.perms, N'') NOT LIKE N'%specapprove%';
PRINT N'[spec-approve] 追加 specapprove 行数 = ' + CAST(@@ROWCOUNT AS nvarchar(10));
GO

/* ---------- 自检：每个目标角色都必须已含 specapprove ---------- */
IF EXISTS (SELECT 1 FROM #target t
           WHERE NOT EXISTS (SELECT 1 FROM yj_role_panel p
                             WHERE p.role_id = t.role_id AND p.panel_code = N'RD_SPEC_DOC'
                               AND ISNULL(p.perms, N'') LIKE N'%specapprove%'))
    RAISERROR(N'[spec-approve] 自检失败：仍有目标角色没有 specapprove（产品文件列表的批准按钮不会出现）', 16, 1);
PRINT N'[spec-approve] 自检通过：冯敏所在角色已含 specapprove。';
GO

/* ---------- ③ 全库现状（便于复核有多少角色能点批准） ---------- */
DECLARE @n INT;
SELECT @n = COUNT(*) FROM yj_role_panel
 WHERE panel_code = N'RD_SPEC_DOC' AND ISNULL(perms, N'') LIKE N'%specapprove%';
PRINT N'[spec-approve] 当前可点「批准」的角色数（不含管理员恒放行）= ' + CAST(@n AS nvarchar(10));
GO