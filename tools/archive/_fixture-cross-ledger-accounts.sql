-- ══════════════════════════════════════════════════════════════════════════
-- 夹具:造出"两个账套账号/权限不一致"的局面,用于验证跨账套切换(2026-09-22)
--   ⚠ 只对**测试库 HSDZ_MES_TEST** 执行(正式库不许造测试数据);
--   ⚠ 跑完必须执行同目录语义的清理脚本(见本文件末尾),否则测试库会留下假账号/被改的 admin。
-- 配的探针:tools/archive/_probe-account-mismatch.cjs
-- ══════════════════════════════════════════════════════════════════════════

-- ① 造一个"只在测试库存在"的账号(复制 admin 的口令哈希 ⇒ 密码仍是 123456),
--    故意设为非管理员 + 仓库角色,这样它的可见面板是窄集(26/164)
IF NOT EXISTS (SELECT 1 FROM yj_user WHERE username = 'switchprobe')
  INSERT INTO yj_user (username, password_hash, real_name, is_admin, role_id)
  SELECT 'switchprobe', password_hash, N'仅测试库账号', 'N', role_id FROM yj_user WHERE username = 'demo_cangku';

-- ② 把测试库的 admin 降级成仓库角色 ⇒ 与正式库(管理员)形成"同名账号、权限不同"
UPDATE yj_user SET is_admin = 'N', role_id = (SELECT role_id FROM yj_user WHERE username = 'demo_cangku')
WHERE username = 'admin';

SELECT username, real_name, is_admin, role_id FROM yj_user ORDER BY username;

-- ── 清理(跑完用手执行,或执行 _fixture-cross-ledger-cleanup.sql)────────────────
-- DELETE FROM yj_user WHERE username = 'switchprobe';
-- UPDATE yj_user SET is_admin = 'Y', role_id = 1 WHERE username = 'admin';
