-- 夹具(仅测试库):只读受限账号(role=仓管,密码沿用 admin 的哈希=123456)
IF NOT EXISTS (SELECT 1 FROM yj_user WHERE username = 'switchprobe')
  INSERT INTO yj_user (username, password_hash, real_name, is_admin, role_id)
  SELECT 'switchprobe', password_hash, N'仅测试库账号', 'N', (SELECT role_id FROM yj_user WHERE username = 'demo_cangku')
  FROM yj_user WHERE username = 'admin';
SELECT username, is_admin, role_id FROM yj_user WHERE username = 'switchprobe';
