/* =============================================================================
   cleanup-user-accounts-sync-20261016.sql — 本地账号与部署包对齐:只保留 5 个

   用户口径(2026-10-16):「账号本地与其包同步只需要 5 个账号」。
   依据 = 部署包 pkg-full-20261016c.zip 里 HSDZ_MES.bak 的实测(yj_user 恰好 5 行,已还原核对):
     admin(系统管理员·管理员) / cp(陈秀丽·研发审核)
     / liulei(刘磊·文件负责人) / chaishanyin(柴善银·文件负责人) / fengmin(冯敏·文件负责人)
   本地开发库多出 8 个:glm53(彭于晏)、tester01(测试用户·本就停用)、7 个演示账号
     (demo_jihua/demo_xiaoshou/demo_pinzhi/demo_gongyi/demo_shengchan/demo_cangku —— 演示用,
      需要时可由 seed-demo-prodfile.sql 一类演示脚本重新造出来)。

   【只删什么】yj_user 里 username 不在保留名单内的行(硬删,与包内行集完全一致);
     ⚠ 这些账号在单据里只以**文本**出现在 asp_user1/asp_user2/审核人等列,删行不会破坏单据数据。
   【幂等】第二次执行删 0 行。两个账套都执行(先 HSDZ_MES,后 HSDZ_MES_TEST)。
   【回滚】需要恢复演示账号:重新跑演示造数脚本(seed-demo-prodfile.sql 等)即可,不需要备份。
   【执行】cd tools
     java -Dstdout.encoding=UTF-8 -cp lib\mssql-jdbc.jar DbSync.java run cleanup-user-accounts-sync-20261016.sql
   ⚠ 不要登记进 tools/db-migrations.txt。
   ============================================================================= */
SET NOCOUNT ON;

DECLARE @keep TABLE (u sysname PRIMARY KEY);
INSERT INTO @keep (u) VALUES (N'admin'), (N'cp'), (N'liulei'), (N'chaishanyin'), (N'fengmin');

IF OBJECT_ID('tempdb..#del') IS NOT NULL DROP TABLE #del;
CREATE TABLE #del (u sysname, real_name nvarchar(50), enabled bit);
INSERT INTO #del (u, real_name, enabled)
SELECT u.username, ISNULL(u.real_name, N''), u.enabled
FROM yj_user u WHERE u.username NOT IN (SELECT u FROM @keep);

DECLARE @n int = (SELECT COUNT(*) FROM #del);
DECLARE @dbn sysname = DB_NAME();
RAISERROR(N'[待删] %s:账号 %d 个', 10, 1, @dbn, @n);

BEGIN TRANSACTION;
DELETE FROM yj_user WHERE username IN (SELECT u FROM #del);
DECLARE @del int = @@ROWCOUNT;

/* 自检:① 恰好剩 5 个 ② 5 个保留账号一个不少 ③ 没有保留名单外的账号 */
DECLARE @left int = (SELECT COUNT(*) FROM yj_user);
DECLARE @keepLeft int = (SELECT COUNT(*) FROM yj_user WHERE username IN (SELECT u FROM @keep));
DECLARE @extra int = (SELECT COUNT(*) FROM yj_user WHERE username NOT IN (SELECT u FROM @keep));
IF @left <> 5 OR @keepLeft <> 5 OR @extra <> 0
BEGIN
  ROLLBACK TRANSACTION;
  RAISERROR(N'[FAIL] 自检未过(剩余 %d / 保留命中 %d / 名单外 %d),已整段回滚', 16, 1, @left, @keepLeft, @extra);
  RETURN;
END
COMMIT TRANSACTION;
RAISERROR(N'[OK] %s:删除账号 %d 个,剩余 5 个(admin/cp/liulei/chaishanyin/fengmin)', 10, 1, @dbn, @del);
GO

SELECT username, ISNULL(real_name, N'') AS 姓名, enabled FROM yj_user ORDER BY id;
GO
