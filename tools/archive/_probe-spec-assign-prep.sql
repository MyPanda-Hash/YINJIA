/* _probe-spec-assign-prep.sql — 规格书两级分发探针前置(一次性,不登记 db-migrations.txt)
   1) 快照 tester01 原 hash/启用状态(清理时还原)
   2) 临时启用 tester01,密码临时换成 glm53 同款(=123456)——探针里作 责任人 t1
   3) 克隆 tester01 角色造 SPECT2(无关第三人,有 RD_SPEC_DOC/RD_PROD_INFO 编辑权)
   执行:sqlcmd -f 65001 -S localhost -E -d HSDZ_MES -i tools\_probe-spec-assign-prep.sql */
SET NOCOUNT ON;
GO
IF OBJECT_ID('dbo._probe_spec_users_bak','U') IS NOT NULL DROP TABLE dbo._probe_spec_users_bak;
SELECT username, password_hash, enabled INTO dbo._probe_spec_users_bak FROM dbo.yj_user WHERE username = 'tester01';
GO
UPDATE u SET u.password_hash = g.password_hash, u.enabled = '1'
  FROM dbo.yj_user u CROSS JOIN dbo.yj_user g WHERE u.username = 'tester01' AND g.username = 'glm53';
GO
IF NOT EXISTS (SELECT 1 FROM dbo.yj_user WHERE username = 'SPECT2')
INSERT INTO dbo.yj_user (username, password_hash, real_name, is_admin, role_id, enabled)
SELECT 'SPECT2', g.password_hash, N'规格书探员', 'N', u.role_id, '1'
  FROM dbo.yj_user u CROSS JOIN dbo.yj_user g WHERE u.username = 'tester01' AND g.username = 'glm53';
GO
PRINT N'探针账号就绪(tester01 已临时启用,SPECT2 已建)';
GO
