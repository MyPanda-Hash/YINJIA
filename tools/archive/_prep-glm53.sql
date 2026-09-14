USE HSDZ_MES;
SET NOCOUNT ON;
-- 探针准备:glm53 密码对齐 admin(同 bcrypt('123456')),供二级审批分角色测试(本地测试库)
UPDATE u SET u.password_hash = a.password_hash
FROM yj_user u CROSS JOIN (SELECT password_hash FROM yj_user WHERE username='admin') a
WHERE u.username = 'glm53';
SELECT username, real_name FROM yj_user WHERE username='glm53';
