-- 清理 _fixture-cross-ledger-accounts.sql 造出的夹具(仅测试库 HSDZ_MES_TEST)
-- 跑完核对:两个账套的 yj_user 行数应一致,admin 应恢复 is_admin='Y' / role_id=1
DELETE FROM yj_user WHERE username = 'switchprobe';
UPDATE yj_user SET is_admin = 'Y', role_id = 1 WHERE username = 'admin';
SELECT username, is_admin, role_id FROM yj_user WHERE username IN ('admin', 'switchprobe') ORDER BY username;
SELECT COUNT(*) AS users_after FROM yj_user;
