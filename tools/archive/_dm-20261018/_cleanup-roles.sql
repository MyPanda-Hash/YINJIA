SET NOCOUNT ON;
-- 清掉开发期遗留的测试角色(无任何账号引用):DBG2 + 两个自动化角色
DELETE FROM yj_role_panel WHERE role_id IN (5,6,7);
SELECT @@ROWCOUNT AS 删除授权行;
DELETE FROM yj_role WHERE id IN (5,6,7) AND NOT EXISTS (SELECT 1 FROM yj_user u WHERE u.role_id = yj_role.id);
SELECT @@ROWCOUNT AS 删除角色;
SELECT COUNT(*) AS 残留edit FROM yj_role_panel WHERE perms LIKE '%edit%';
SELECT id, role_name FROM yj_role;
