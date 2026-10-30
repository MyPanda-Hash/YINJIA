/* ============================================================================
   migrate-drop-test-progress-20261030.sql
   测试申请单(RD_DOM_TEST)不再进「项目进度查询」—— 清掉历史同步行(2026-10-30)

   【用户口径·原话】
     「测试申请单不在这个项目进度查询里面显示,那个不是在测试申请单的汇总里面显示吗?
       修复这个问题」

   【背景(为什么库里会有几行 DT-xxx)】
     2026-09-30 曾按「四级项目要进进度查询」加过 ButtonService.syncTestDocsToProgress:
     把每张「测试申请单 RD_DOM_TEST」同步成一条 rd_progress_detail「项目层级=四级」行
     (INSERT 时 asp_user1 硬编码 'sync' 作落库标记)。
     服务器上因此出现「立项申请里根本没有 DT-xxx 单据,项目进度查询却显示两行」——
     四级分支的源头本来就是测试申请单,不是立项申请。
     2026-10-30 口径变更:测试申请单自己的汇总面板(RD_DOM_TEST)就够了,不再进进度查询;
     代码侧已整段删除该同步方法,pruneProgressRows 的 ①b 分支改为按 asp_user1='sync' 清理。

   【本脚本做什么】
     一次性把**存量**四级同步行标软删(asp_cancel='Y'):
       · 判据 = [项目层级]='四级' AND asp_user1='sync'
         —— 只清"旧同步方法生成"的行;人工建的四级行(asp_user1 不是 sync)一行不动;
       · 只标 asp_cancel='Y',不物理删除,可回溯、可幂等复跑。

   ⚠ 幂等:已标 asp_cancel='Y' 的行不会再被选中 ⇒ 复跑命中 0 行。
   ⚠ 两账套都要跑(先 HSDZ_MES 后 HSDZ_MES_TEST),已登记 tools/db-migrations.txt。
   ⚠ 执行顺序:文件名按字母序,d 在 p 前 ⇒ 本脚本先于
     migrate-prune-voided-progress-20261030.sql 执行;后者此时已看不到四级行,互不影响。
   ============================================================================ */

SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRAN;

DECLARE @dbn sysname = DB_NAME();
DECLARE @before int, @after int, @n int;

SELECT @before = COUNT(*) FROM rd_progress_detail WHERE ISNULL(asp_cancel,'N') <> 'Y';

/* ── 主清理:测试申请单同步来的四级行 ── */
UPDATE rd_progress_detail
   SET asp_cancel = 'Y',
       asp_user2  = N'drop-test-progress-20261030',
       asp_time2  = GETDATE()
 WHERE ISNULL(asp_cancel,'N') <> 'Y'
   AND [项目层级] = N'四级'
   AND ISNULL(asp_user1, N'') = N'sync';

SET @n = @@ROWCOUNT;

SELECT @after = COUNT(*) FROM rd_progress_detail WHERE ISNULL(asp_cancel,'N') <> 'Y';

PRINT N'[DB] ' + @dbn;
PRINT N'[OK] 清理四级测试单同步行 ' + CAST(@n AS nvarchar(20)) + N' 行'
    + N'(存活行 ' + CAST(@before AS nvarchar(20)) + N' → ' + CAST(@after AS nvarchar(20)) + N')';

/* ── 自检:同类行必须 0 残留,否则回滚 ── */
DECLARE @left int;
SELECT @left = COUNT(*)
  FROM rd_progress_detail
 WHERE ISNULL(asp_cancel,'N') <> 'Y'
   AND [项目层级] = N'四级'
   AND ISNULL(asp_user1, N'') = N'sync';

IF @left <> 0
BEGIN
    ROLLBACK TRAN;
    RAISERROR(N'[FAIL] %s:清理后仍有 %d 行四级测试单同步行,已回滚', 16, 1, @dbn, @left);
    RETURN;
END

COMMIT TRAN;

PRINT N'[SELF-CHECK OK] 四级测试单同步行残留 = 0';
