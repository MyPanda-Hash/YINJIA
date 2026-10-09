-- q-01-cleanup-check.sql — 探针收尾核对:两账套里不应残留 extperm 探针账号/角色/授权行
-- 用法(两账套各跑一遍):
--   cd tools && java -cp lib\mssql-jdbc.jar SqlRunner.java "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false" yinjia <pass> archive\_extperm\q-01-cleanup-check.sql
SET NOCOUNT ON;

SELECT DB_NAME() AS db;

PRINT N'【1】探针账号(应为 0)';
SELECT COUNT(*) AS probe_users FROM yj_user WHERE username LIKE N'extperm%';

PRINT N'【2】探针角色(应为 0)';
SELECT COUNT(*) AS probe_roles FROM yj_role WHERE role_code LIKE N'extperm%';

PRINT N'【3】探针角色的面板授权行(应为 0)';
SELECT COUNT(*) AS probe_grants FROM yj_role_panel rp
 JOIN yj_role r ON r.id = rp.role_id
 WHERE r.role_code LIKE N'extperm%';

PRINT N'【4】现役持有 field 词的角色/面板(本任务上线后由管理员自行勾选;此处只报数)';
SELECT r.role_code, COUNT(*) AS panels_with_field
  FROM yj_role_panel rp JOIN yj_role r ON r.id = rp.role_id
 WHERE rp.perms LIKE N'%field%'
 GROUP BY r.role_code;
