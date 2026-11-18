/* ============================================================================
 * migrate-restore-rd-del-batch-20261117.sql
 * 恢复 2026-11-17 13:52:26~13:52:52 被批量删除的 10 张研发单据（烧结/X烧结）
 * ----------------------------------------------------------------------------
 * 背景（用户 2026-11-18 报障「怎么单据就这两张了，是不是部署把单据弄丢了」）：
 *   库里的单据一张没少，但绝大多数在 yj_doc_status 里 canceled='Y'（**删除按钮**的软删标记，
 *   见 ButtonService 头注释「删除:单据=yj_doc_status.canceled='Y'」），列表默认不显示。
 *   查 cancel_by/cancel_at 发现：admin 在 **26 秒内连续删了 10 张**（跨两个面板），
 *   节奏不像逐张人工确认 ⇒ 用户判定「疑似误删」，只回这一批（其余保留删除状态）。
 *
 * 精确范围（双保险：时间窗 + 显式单号）：
 *   panel_code ∈ (RD_MOLD_PROC, RD_X_SINTER)
 *   AND cancel_by = 'admin'
 *   AND cancel_at BETWEEN '2026-11-17 13:52:26' AND '2026-11-17 13:52:53'
 *   AND doc_no IN (下面 10 个)
 *
 * 已核对：这 10 张的单据头 asp_cancel 全部 = 'N'（不是业务表软删），所以只需恢复状态行。
 * 幂等：WHERE 带 canceled='Y'，重复执行 0 行。两账套都执行（测试库可能没有这些单，0 行即正常）。
 * ========================================================================== */

SET NOCOUNT ON;

IF OBJECT_ID('yj_doc_status') IS NULL
    RAISERROR(N'[restore-1117] 缺 yj_doc_status', 16, 1);
GO

DECLARE @docs TABLE (no nvarchar(60) PRIMARY KEY);
INSERT INTO @docs (no) VALUES
    (N'MP-2026-11-0022'), (N'MP-2026-11-0013'), (N'MP-2026-11-0012'),
    (N'MP-2026-11-0007'), (N'MP-2026-11-0020'), (N'MP-2026-11-0019'),
    (N'MP-2026-11-0018'), (N'MP-2026-11-0016'), (N'MP-2026-11-0006'),
    (N'XS-2026-11-0002');

UPDATE s
   SET s.canceled  = 'N',
       s.cancel_by = NULL,
       s.cancel_at = NULL,
       s.update_at = GETDATE()
  FROM yj_doc_status s
  JOIN @docs d ON d.no = s.doc_no
 WHERE s.panel_code IN (N'RD_MOLD_PROC', N'RD_X_SINTER')
   AND ISNULL(s.canceled, 'N') = 'Y'
   AND s.cancel_by = 'admin'
   AND s.cancel_at BETWEEN '2026-11-17 13:52:26' AND '2026-11-17 13:52:53';
PRINT N'[restore-1117] 恢复单据 = ' + CAST(@@ROWCOUNT AS nvarchar(10));
GO

/* ---------- 自检：这 10 张不该再有 canceled='Y' ---------- */
DECLARE @bad int = 0;
SELECT @bad = COUNT(*) FROM yj_doc_status
 WHERE doc_no IN (N'MP-2026-11-0022', N'MP-2026-11-0013', N'MP-2026-11-0012',
                  N'MP-2026-11-0007', N'MP-2026-11-0020', N'MP-2026-11-0019',
                  N'MP-2026-11-0018', N'MP-2026-11-0016', N'MP-2026-11-0006',
                  N'XS-2026-11-0002')
   AND ISNULL(canceled, 'N') = 'Y';
IF @bad > 0 RAISERROR(N'[restore-1117] 自检失败：仍有已删除状态', 16, 1);
PRINT N'[restore-1117] 自检通过。';
GO
