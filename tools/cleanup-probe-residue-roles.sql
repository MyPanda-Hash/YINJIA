-- ============================================================================
-- 清理探针残留角色(自动化测试留下的垃圾角色)
-- 日期:2026-10-10
-- 背景:多次跑 tools/verify/*.cjs 视觉探针时,探针会点「保存面板权限」。
--       SysAdminService.saveRolePanels 是「先删后插」,探针另建的临时角色
--       因此永久留在了库里。实测 4 个:
--         id=3 zz_probe                探针角色
--         id=6 AUTO_ROLE_DBG2          DBG2
--         id=7 AUTO_ROLE_mtv0tplg6526  自动化角色_AUTO_ROLE_mtv0tplg6526
--         id=8 AUTO_ROLE_mtv0uh5p3ce0  自动化角色_AUTO_ROLE_mtv0uh5p3ce0
--       两账套完全对称:各 4 行 yj_role + 159 行 yj_role_panel,
--       yj_user 挂载数 = 0(无任何账号使用)⇒ 删除安全。
--
-- 注意:yj_role.id 是 IDENTITY,删掉不会重排;若日后需要重建同名角色,
--       新 id 会从当前种子值往后取,不会复用 3/6/7/8。
--
-- 回滚:见文件末尾注释块(备份数据在 tools/verify/_probe-roles-backup.tsv)。
-- 执行:HSDZ_MES 与 HSDZ_MES_TEST 双账套各执行一次。
-- ============================================================================

-- 执行前核对:应为 4 行角色、159 行权限、0 个用户挂载
SELECT 'roles' AS what, COUNT(*) AS n FROM yj_role WHERE id IN (3, 6, 7, 8)
UNION ALL
SELECT 'role_panels', COUNT(*) FROM yj_role_panel WHERE role_id IN (3, 6, 7, 8)
UNION ALL
SELECT 'users_mounted', COUNT(*) FROM yj_user WHERE role_id IN (3, 6, 7, 8);

-- 安全闸:若真有用户挂在这些角色上,整个批次回滚并抛错,不静默删。
IF EXISTS (SELECT 1 FROM yj_user WHERE role_id IN (3, 6, 7, 8))
BEGIN
    RAISERROR (N'有用户挂载在待删角色上,已中止清理。请先改派用户角色。', 16, 1);
    RETURN;
END

BEGIN TRANSACTION;

DELETE FROM yj_role_panel WHERE role_id IN (3, 6, 7, 8);
DELETE FROM yj_role       WHERE id      IN (3, 6, 7, 8);

COMMIT TRANSACTION;

-- 执行后核对:三行都应为 0
SELECT 'roles' AS what, COUNT(*) AS n FROM yj_role WHERE id IN (3, 6, 7, 8)
UNION ALL
SELECT 'role_panels', COUNT(*) FROM yj_role_panel WHERE role_id IN (3, 6, 7, 8)
UNION ALL
SELECT 'users_mounted', COUNT(*) FROM yj_user WHERE role_id IN (3, 6, 7, 8);

-- 剩余角色应为 4 个:admin / user / rd_review / rd_file_owner
SELECT id, role_code, role_name FROM yj_role ORDER BY id;

-- ============================================================================
-- 回滚(如需恢复,在两个账套分别执行;perms 原文见
--       tools/verify/_probe-roles-backup.tsv,格式 kind/a/b/c/d):
--
-- INSERT INTO yj_role (id, role_code, role_name, remark, is_admin) VALUES
--   (3, N'zz_probe',               N'探针角色', NULL, N'N'),
--   (6, N'AUTO_ROLE_DBG2',         N'DBG2',      NULL, N'N'),
--   (7, N'AUTO_ROLE_mtv0tplg6526', N'自动化角色_AUTO_ROLE_mtv0tplg6526', NULL, N'N'),
--   (8, N'AUTO_ROLE_mtv0uh5p3ce0', N'自动化角色_AUTO_ROLE_mtv0uh5p3ce0', NULL, N'N');
-- SET IDENTITY_INSERT yj_role OFF;
--
-- 159 行 yj_role_panel 逐行 INSERT 见备份 tsv 的 PERM 行
-- (role_id / panel_code / perms / can_approve)。
-- ============================================================================
