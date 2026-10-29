/* ============================================================================
   migrate-prune-voided-progress-20261030.sql
   已作废/删除的研发单据 → 从「项目进度查询」清掉对应行(2026-10-30)

   【用户报障·原话】
     「我服务器上已经把这个213项目的立项申请和项目实施计划删掉了,但是现在还出现在
      项目进度查询,以及项目流程管控那些已经弃审废弃删除的单据流程就不需要再追踪了,
      现在还能看到,而且删除不了」

   【根因】(代码已同批修好,见 ButtonService.pruneProgressRows / voidDoc / RdProjectFlowService)
     ① 作废/删除单据时 voidDoc 只写 yj_doc_status.canceled='Y',**不动业务表 asp_cancel**;
     ② pruneProgressRows 判"源单据还在不在"时只查 asp_cancel、**没查状态表**
        ⇒ 已作废的单据被当成还活着,进度行永远清不掉;
     ③ 作废后也**没有触发**清理,要等下一次「同步进度」;
     ④ 项目进度查询是只读面板(READONLY_PANELS),用户没有人工删除入口 ⇒ 表现为"删除不了"。

   【本脚本做什么】
     一次性把**存量**孤儿进度行标软删(asp_cancel='Y'):
       · 判据与修复后的 pruneProgressRows **完全一致**(见下方注释);
       · 只标 asp_cancel='Y',不物理删除,可回溯、可幂等复跑;
       · 打印清理前后的行数,便于核对。

   【为什么不做成"DELETE"】全库口径是软删(asp_cancel),硬删会丢历史留痕。

   ⚠ 幂等:已标 asp_cancel='Y' 的行不会再被选中 ⇒ 复跑 0 行。
   ⚠ 两账套都要跑(先 HSDZ_MES 后 HSDZ_MES_TEST),已登记 tools/db-migrations.txt。
   ============================================================================ */

SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRAN;

DECLARE @dbn sysname = DB_NAME();
DECLARE @before int, @after int;

SELECT @before = COUNT(*)
  FROM rd_progress_detail
 WHERE ISNULL(asp_cancel,'N') <> 'Y';

/* ── 主清理:与 ButtonService.pruneProgressRows 同判据 ──
   三个分支任一成立即"孤儿":
   ① 计划行([说明]=[项目编号]=立项/计划文档编号)在**未作废**的实施计划或立项申请里都找不到;
      —— 判据必须带 [说明]=[项目编号] 守卫:四级行(见 ②)的 [说明] 存的是测试背景文本,
         不加守卫会把它们当孤儿一起清掉。
   ② 四级行(项目层级='四级')的来源是「简单开发/检测申请单」rd_dom_test_head,
      单号存在 [项目编号] 上 ⇒ 该单不存在或已作废(canceled='Y')即视为孤儿;
   ③ 所属进度单本身已作废/不存在(换过汇总单后的旧行)。 */
UPDATE rd_progress_detail
   SET asp_cancel = 'Y',
       asp_user2  = N'prune-voided-20261030',
       asp_time2  = GETDATE()
 WHERE ISNULL(asp_cancel,'N') <> 'Y'
   AND (
        /* ① 计划/立项来源行 */
        (ISNULL([说明], N'') <> ''
         AND ISNULL([说明], N'') = ISNULL([项目编号], N'')
         AND [说明] NOT IN (
             SELECT p.[文档编号] FROM rd_plan p
              WHERE ISNULL(p.asp_cancel,'N') <> 'Y'
                AND ISNULL(p.[文档编号], N'') <> N''
                AND NOT EXISTS (SELECT 1 FROM yj_doc_status s
                                 WHERE s.panel_code = N'RD_PLAN'
                                   AND s.doc_no = p.[单据编号]
                                   AND ISNULL(s.canceled,'N') = 'Y')
             UNION
             SELECT a.[文档编号] FROM rd_approval a
              WHERE ISNULL(a.asp_cancel,'N') <> 'Y'
                AND ISNULL(a.[文档编号], N'') <> N''
                AND NOT EXISTS (SELECT 1 FROM yj_doc_status s
                                 WHERE s.panel_code = N'RD_APPROVAL'
                                   AND s.doc_no = a.[单据编号]
                                   AND ISNULL(s.canceled,'N') = 'Y')
         ))
        /* ② 四级(测试申请单)来源行 */
     OR ([项目层级] = N'四级'
         AND ISNULL([项目编号], N'') <> N''
         AND NOT EXISTS (
             SELECT 1 FROM rd_dom_test_head h
              WHERE h.[单据编号] = rd_progress_detail.[项目编号]
                AND ISNULL(h.asp_cancel,'N') <> 'Y'
                AND NOT EXISTS (SELECT 1 FROM yj_doc_status s
                                 WHERE s.panel_code = N'RD_DOM_TEST'
                                   AND s.doc_no = h.[单据编号]
                                   AND ISNULL(s.canceled,'N') = 'Y')))
        /* ③ 挂在死单上的行 */
     OR NOT EXISTS (SELECT 1 FROM rd_progress p
                     WHERE p.[单据编号] = rd_progress_detail.[单据编号]
                       AND ISNULL(p.asp_cancel,'N') <> 'Y')
   );

DECLARE @n int = @@ROWCOUNT;

SELECT @after = COUNT(*)
  FROM rd_progress_detail
 WHERE ISNULL(asp_cancel,'N') <> 'Y';

PRINT N'[DB] ' + @dbn;
PRINT N'[OK] 清理孤儿进度行 ' + CAST(@n AS nvarchar(20)) + N' 行'
    + N'(存活行 ' + CAST(@before AS nvarchar(20)) + N' → ' + CAST(@after AS nvarchar(20)) + N')';

/* ── 自检:清理后再判一次,必须 0 行残留 ── */
DECLARE @left int;
SELECT @left = COUNT(*)
  FROM rd_progress_detail d
 WHERE ISNULL(d.asp_cancel,'N') <> 'Y'
   AND (
        (ISNULL(d.[说明], N'') <> ''
         AND ISNULL(d.[说明], N'') = ISNULL(d.[项目编号], N'')
         AND d.[说明] NOT IN (
             SELECT p.[文档编号] FROM rd_plan p
              WHERE ISNULL(p.asp_cancel,'N') <> 'Y'
                AND ISNULL(p.[文档编号], N'') <> N''
                AND NOT EXISTS (SELECT 1 FROM yj_doc_status s
                                 WHERE s.panel_code = N'RD_PLAN'
                                   AND s.doc_no = p.[单据编号]
                                   AND ISNULL(s.canceled,'N') = 'Y')
             UNION
             SELECT a.[文档编号] FROM rd_approval a
              WHERE ISNULL(a.asp_cancel,'N') <> 'Y'
                AND ISNULL(a.[文档编号], N'') <> N''
                AND NOT EXISTS (SELECT 1 FROM yj_doc_status s
                                 WHERE s.panel_code = N'RD_APPROVAL'
                                   AND s.doc_no = a.[单据编号]
                                   AND ISNULL(s.canceled,'N') = 'Y')
         ))
     OR (d.[项目层级] = N'四级'
         AND ISNULL(d.[项目编号], N'') <> N''
         AND NOT EXISTS (
             SELECT 1 FROM rd_dom_test_head h
              WHERE h.[单据编号] = d.[项目编号]
                AND ISNULL(h.asp_cancel,'N') <> 'Y'
                AND NOT EXISTS (SELECT 1 FROM yj_doc_status s
                                 WHERE s.panel_code = N'RD_DOM_TEST'
                                   AND s.doc_no = h.[单据编号]
                                   AND ISNULL(s.canceled,'N') = 'Y')))
     OR NOT EXISTS (SELECT 1 FROM rd_progress p
                     WHERE p.[单据编号] = d.[单据编号]
                       AND ISNULL(p.asp_cancel,'N') <> 'Y')
   );

IF @left <> 0
BEGIN
    ROLLBACK TRAN;
    RAISERROR(N'[FAIL] %s:清理后仍有 %d 行孤儿进度行,已回滚', 16, 1, @dbn, @left);
    RETURN;
END

COMMIT TRAN;

PRINT N'[SELF-CHECK OK] 孤儿进度行残留 = 0';
