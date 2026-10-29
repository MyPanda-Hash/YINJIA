/* =============================================================================
   migrate-wlbom-selfmodify-20261029.sql
   -----------------------------------------------------------------------------
   用户口径(2026-10-29,最终版):
     「我现在想的是肯定是要能保存归档的,但是加上一个修改按钮,点击之后就退回草稿状态,
       然后就可以继续修改了,修改完再保存就行了」

   ── 前因(别搞混两版)──────────────────────────────────────────────────────
   同日早先的报障是「物料清单保存之后是不能修改的」。第一版理解成"保存后要保持草稿",
   把 WLBOM 从归档集合移出;用户随即澄清:**归档要保留**,缺的是**归档后的退路**。
   最终实现:
     · WLBOM 仍在 DOC_ARCHIVE_PANELS + SELF_MAINTAINED_PANELS ⇒ 保存即归档;
     · 侧栏新增「修改」按钮(=ButtonService.selfModify)⇒ 已归档/已审核 → 直接退回草稿;
     · 退回前落快照,改完保存即重新归档,「修改记录」照样逐条留痕;
     · 不走文书那套「申请修改→管理员审批→修改中」(基础数据不该被审批权卡住)。

   ── 本脚本做什么 ─────────────────────────────────────────────────────────
   **把此前被第一版逻辑退回草稿的单据,恢复成已归档** —— 它们本来就是"填完定稿"的数据,
   不该停在草稿;恢复后用户仍可通过「修改」按钮随时退回。
   ⚠ 只恢复「有实际数据、且当前是草稿、且从未走过审批」的 WLBOM 单;
     人工刻意留成草稿的(比如正在录一半)不动 —— 判据:该单在 mate 里行数 > 0 且
     yj_doc_status.archived 为空 且 pending 为空。

   ── 幂等 ─────────────────────────────────────────────────────────────────
   重复执行第二次影响 0 行。

   ⚠ 本脚本**只对曾经跑过第一版迁移(migrate-wlbom-editable-20261029.sql)的环境**有意义。
     如果你的环境没跑过那一版,WLBOM 单据本来就还是已归档,本脚本影响 0 行,安全。
   ============================================================================= */
SET NOCOUNT ON;
GO

PRINT '=== 处理前:WLBOM 单据状态分布 ===';
SELECT ISNULL(archived,'(空)') AS archived, ISNULL(pending,'(空)') AS pending, COUNT(*) AS n
FROM yj_doc_status WHERE panel_code = N'WLBOM'
GROUP BY archived, pending;
GO

/* ---------- 恢复:被误退回草稿的、有数据的单 → 已归档 ---------- */
DECLARE @n int;
UPDATE s
   SET s.archived   = 'Y',
       s.archived_at = ISNULL(s.archived_at, GETDATE()),
       s.update_at  = GETDATE()
  FROM yj_doc_status s
 WHERE s.panel_code = N'WLBOM'
   -- ⚠ 旧迁移写的是 archived='N'(不是 NULL)⇒ 判空必须同时认 NULL / '' / 'N',
   --   否则恢复语句一行都匹配不上(实测第一次跑就是因此 0 行)。
   AND ISNULL(NULLIF(s.archived, N'N'), N'') = N''
   AND ISNULL(NULLIF(s.pending,  N'N'), N'') = N''
   AND EXISTS (SELECT 1 FROM dbo.mate m
               WHERE m.m_no = s.doc_no AND ISNULL(m.asp_cancel, N'N') <> N'Y');
SET @n = @@ROWCOUNT;
PRINT N'[OK] 恢复为已归档: ' + CAST(@n AS nvarchar(10)) + N' 张';
GO

PRINT '=== 处理后:WLBOM 单据状态分布 ===';
SELECT ISNULL(archived,'(空)') AS archived, ISNULL(pending,'(空)') AS pending, COUNT(*) AS n
FROM yj_doc_status WHERE panel_code = N'WLBOM'
GROUP BY archived, pending;
GO
PRINT N'migrate-wlbom-selfmodify-20261029.sql 完成（「修改」按钮由代码提供，无表结构变更）';
GO
