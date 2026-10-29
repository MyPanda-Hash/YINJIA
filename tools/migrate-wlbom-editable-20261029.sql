/* =============================================================================
   migrate-wlbom-editable-20261029.sql
   -----------------------------------------------------------------------------
   用户口径(2026-10-29):「现在先改本地的物料清单,是可以直接修改的,这个是不需要审批的,
                         现在保存之后是不能修改的」

   ── 根因 ──────────────────────────────────────────────────────────────────
   WLBOM 当年被登记进 ButtonService.SELF_MAINTAINED_PANELS(保存即归档) +
   DOC_ARCHIVE_PANELS,于是保存后 yj_doc_status.archived='Y'(单据状态=已归档);
   而前端 PanelxList 的 draftEditable 只认 草稿 / 修改中 / 档案面板的启用·停用
   ⇒ **存一次就锁死,再也改不了**。

   代码侧修复(同批提交):
     · ButtonService:SELF_MAINTAINED_PANELS 与 DOC_ARCHIVE_PANELS 双双移出 WLBOM
       ⇒ 保存后保持草稿;
     · PanelConfigService:新增 NOT_APPROVAL_PANELS={WLBOM},工具栏仍不出审批按钮
       (证据:用户明确「不需要审批」)。

   本脚本 = **存量数据回正**:把已经被旧逻辑置成"已归档"的 WLBOM 单退回草稿,
   否则代码改完这些老单仍然不可编辑。

   ── 幂等 ─────────────────────────────────────────────────────────────────
   只动 archived='Y' 且未送审(pending<>'Y')的 WLBOM 行;重复执行第二次影响 0 行。
   同时撤掉修改态(modify_state),避免残留"修改中"让单据看起来像在流程里。
   ============================================================================= */
SET NOCOUNT ON;
GO

PRINT '=== 处理前:WLBOM 单据状态分布 ===';
SELECT archived, pending, COUNT(*) AS n
FROM yj_doc_status WHERE panel_code = N'WLBOM'
GROUP BY archived, pending;
GO

/* ---------- 回正:已归档 → 草稿 ---------- */
DECLARE @n int;
UPDATE yj_doc_status
   SET archived    = 'N',
       pending     = 'N',
       pending_by  = NULL,
       pending_at  = NULL,
       modify_state = NULL,
       update_at   = GETDATE()
 WHERE panel_code = N'WLBOM'
   AND ISNULL(archived, 'N') = 'Y'
   AND ISNULL(pending, 'N') <> 'Y';
SET @n = @@ROWCOUNT;
PRINT N'[OK] 物料清单 已归档→草稿: ' + CAST(@n AS nvarchar(10)) + N' 张';
GO

/* ---------- 自检:不应再有已归档 ---------- */
DECLARE @bad int = (SELECT COUNT(*) FROM yj_doc_status
                    WHERE panel_code = N'WLBOM' AND ISNULL(archived,'N') = 'Y');
IF @bad <> 0
    RAISERROR(N'仍有 %d 张 WLBOM 停在已归档', 16, 1, @bad);
ELSE
    PRINT N'[PASS] 物料清单没有已归档单了(全部可编辑)';
GO

PRINT '=== 处理后:WLBOM 单据状态分布 ===';
SELECT archived, pending, COUNT(*) AS n
FROM yj_doc_status WHERE panel_code = N'WLBOM'
GROUP BY archived, pending;
GO
PRINT N'migrate-wlbom-editable-20261029.sql 完成';
GO
