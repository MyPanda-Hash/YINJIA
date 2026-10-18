/* _inject-legacy-perms-20261016.sql —— 迁移效果验证用:在**测试账套**人工造出旧态(严禁在正式账套跑)

用途:证明 migrate-role-perm-words-20261016.sql 真的会把旧词改造好(而不是"因为库里已经干净所以 0 行")。
造三处旧态:
  ① RD_PROGRESS@普通用户 —— 典型 legacy 词串(view,query,add,export,edit,delete,print,price,review,adjust)
  ② ROUTE@研发审核       —— 词序混乱的 legacy 串(旧脚本按另一套顺序写出来的样子)
  ③ RD_SCALE@研发审核     —— 只造「can_approve=Y 但 perms 无 audit」的两层门错位
跑完立即执行迁移,再核对;三处都会被迁移改回规范态。 */
SET NOCOUNT ON;
/* ⚠ RAISERROR 的替换参数**只能是变量或字面量,不能写函数调用**
   (写成 RAISERROR(N'...%s',16,1,DB_NAME()) 报「在 'DB_NAME' 附近有语法错误」,2026-10-16 实测) */
DECLARE @d sysname = DB_NAME();
IF @d <> N'HSDZ_MES_TEST'
BEGIN
  RAISERROR(N'[拒绝] 本脚本只允许在 HSDZ_MES_TEST 执行,当前库 = %s', 16, 1, @d);
  RETURN;
END

UPDATE yj_role_panel SET perms = N'view,query,add,export,edit,delete,print,price,review,adjust', can_approve = 'N'
 WHERE panel_code = N'RD_PROGRESS' AND role_id = (SELECT id FROM yj_role WHERE role_code = N'user');
UPDATE yj_role_panel SET perms = N'view,query,audit,price,review,adjust,print,export,delete,edit,add', can_approve = 'Y'
 WHERE panel_code = N'ROUTE' AND role_id = (SELECT id FROM yj_role WHERE role_code = N'rd_review');
UPDATE yj_role_panel SET can_approve = 'Y'
 WHERE panel_code = N'RD_SCALE' AND role_id = (SELECT id FROM yj_role WHERE role_code = N'rd_review');

RAISERROR(N'[注入完成] 测试账套已造出 legacy 词 2 行 + 审批两层门错位 1 处', 10, 1);
SELECT panel_code, role_id, perms, can_approve FROM yj_role_panel
 WHERE (panel_code = N'RD_PROGRESS' AND role_id = (SELECT id FROM yj_role WHERE role_code = N'user'))
    OR (panel_code IN (N'ROUTE', N'RD_SCALE') AND role_id = (SELECT id FROM yj_role WHERE role_code = N'rd_review'))
 ORDER BY panel_code;
GO
