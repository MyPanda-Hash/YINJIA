/* fix-rd-progress-uncancel-20261019.sql —— 把「项目进度查询」那张单单据的作废位回正
 *
 * 背景(2026-10-19 22:30 用户报「当前项目进度的没了」):
 *   rd_progress 这张全库共用的单单据被 admin 在 13:03 作废(yj_doc_status.canceled='Y'),
 *   而单据列表查询会排除作废单(QueryService: NOT EXISTS ... s.canceled='Y')
 *   ⇒ 面板显示「暂无数据」;单文档面板又隐藏了「新增」,UI 里再也建不回来。
 *
 * 口径:只回正 RD_PROGRESS 的作废位,不动明细、不动头表、不动归档/停工位。
 * 幂等:已经回正时 0 行受影响。
 */
SET NOCOUNT ON;

UPDATE yj_doc_status
   SET canceled   = 'N',
       cancel_by  = NULL,
       cancel_at  = NULL,
       update_at  = SYSDATETIME()
 WHERE panel_code = N'RD_PROGRESS'
   AND ISNULL(canceled, 'N') = 'Y';

PRINT N'[回正] 受影响行数 = ' + CAST(@@ROWCOUNT AS nvarchar(10));

/* 自检:作废位必须归零,且仍有一张可用的进度单头 */
DECLARE @bad int = (SELECT COUNT(*) FROM yj_doc_status WHERE panel_code = N'RD_PROGRESS' AND ISNULL(canceled, 'N') = 'Y');
DECLARE @head int = (SELECT COUNT(*) FROM rd_progress WHERE ISNULL(asp_cancel, 'N') <> 'Y');
IF @bad = 0 AND @head >= 1
    RAISERROR(N'[OK] RD_PROGRESS 作废单 0 张,可用进度单头 %d 张', 10, 1, @head);
ELSE
    RAISERROR(N'[FAIL] 作废单 %d 张 / 可用单头 %d 张', 16, 1, @bad, @head);
GO
