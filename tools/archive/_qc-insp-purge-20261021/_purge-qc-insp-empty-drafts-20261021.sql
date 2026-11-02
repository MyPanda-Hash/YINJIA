/* ============================================================
   _purge-qc-insp-empty-drafts-20261021.sql — 清理「制程检验单 / 首件检验单」的空壳草稿单
   (2026-10-21 用户口径:「当前制程检验单和首件检验单存在许多无用的草稿状态单据,这些单据除去
    自动产生的单号之类的数据无其他任何数量数据,帮我清除掉这些单据。」)

   清理口径(逐条都是"这张单什么业务数据都没有"):
     ① 单据状态 = 草稿 —— 按 QueryService.docStatus 的同一套判据:
        yj_doc_status 里 shr 为空、pending≠Y、canceled≠Y、stopped≠Y、deleting≠Y、
        archived≠Y、modify_state≠Y、effective≠Y(**没有状态行 = 也是草稿**)
     ② 表头关键业务列全空:工单号 / 产品编码 / 检验员 / 批次号(首件另加 生产日期)
     ③ 报工数量 = 0
     ④ 明细**一格都没填**(没有 实测数值 / 结果判断 / 不良数量 的行 —— 自动预铺的空标准行不算数据)
     ⑤ 未作废(asp_cancel≠Y)

   ⇒ 正式库 HSDZ_MES 命中 **制程 15 张 + 首件 63 张 = 78 张**;
      测试库 HSDZ_MES_TEST 命中 **制程 9 张 + 首件 25 张 = 34 张**。

   **刻意不清**(有业务内容,不是"空壳"):
     · 有报工数量的(如 ZC-2026-10-0130 报工 6960 / 首件 SJ-2026-10-0166 报工 6960)—— 手机端
       报工吸收自动出的单,数量在,只是检验明细还没填 ⇒ 属正常待检单;
     · 明细填过实测数值/判定的(如 ZC-2026-10-0001 填了 7 格、SJ-2026-10-0167 填了 1 格);
     · 已审核 / 已作废 / 审批中的单。

   连带清理(只针对命中的单):qc_*_insp_detail、yj_doc_status、yj_form_approval、form_flow_link、
   yj_doc_batch、yj_attachment、yj_doc_annotation(实测正式库这几张对本批命中单均为 0 行,
   测试库有 34 行状态 + 3 行审批)。

   安全:
     · 先按表做**整行快照** `_bak_qcdraft_*_20261021`(原样列,含主键),验收后再 DROP;
     · 目标数必须是「正式 78 / 测试 34」,否则 RAISERROR 中止(防口径漂移、防误删);
     · 全程单事务(SET XACT_ABORT ON),失败整体回滚;
     · 幂等:重跑时目标数变 0 ⇒ 守卫报错中止(不会二次删除),故只在首次执行。

   执行(两个账套各一次,先正式后测试):
     cd tools
     node archive/_qc-insp-purge-20261021/_run.mjs HSDZ_MES      archive/_qc-insp-purge-20261021/_purge-qc-insp-empty-drafts-20261021.sql
     node archive/_qc-insp-purge-20261021/_run.mjs HSDZ_MES_TEST archive/_qc-insp-purge-20261021/_purge-qc-insp-empty-drafts-20261021.sql

   回滚(未 DROP 备份表时):
     INSERT INTO qc_proc_insp_head SELECT * FROM _bak_qcdraft_proc_head_20261021;
     INSERT INTO yj_doc_status     SELECT * FROM _bak_qcdraft_proc_status_20261021;
     …首件同款(_fst_*)
   ============================================================ */
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @db sysname = DB_NAME();
DECLARE @expect int = CASE WHEN @db = N'HSDZ_MES' THEN 78
                           WHEN @db = N'HSDZ_MES_TEST' THEN 34
                           ELSE -1 END;
IF @expect < 0
BEGIN
  RAISERROR(N'[FAIL] 未知账套 %s —— 本脚本只允许在 HSDZ_MES / HSDZ_MES_TEST 执行', 16, 1, @db);
  RETURN;
END

/* ── 1. 算目标(临时表,供后面各段复用) ── */
IF OBJECT_ID('tempdb..#p') IS NOT NULL DROP TABLE #p;
IF OBJECT_ID('tempdb..#f') IS NOT NULL DROP TABLE #f;
CREATE TABLE #p (no nvarchar(100) NOT NULL PRIMARY KEY);
CREATE TABLE #f (no nvarchar(100) NOT NULL PRIMARY KEY);

INSERT INTO #p (no)
SELECT hh.[单据编号]
FROM dbo.qc_proc_insp_head hh
LEFT JOIN dbo.yj_doc_status s ON s.panel_code = N'QC_PROC_INSP' AND s.doc_no = hh.[单据编号]
WHERE ISNULL(hh.asp_cancel, N'N') <> N'Y'
  AND ISNULL(s.shr, N'') = N'' AND ISNULL(s.pending, N'N') <> N'Y' AND ISNULL(s.canceled, N'N') <> N'Y'
  AND ISNULL(s.stopped, N'N') <> N'Y' AND ISNULL(s.deleting, N'N') <> N'Y' AND ISNULL(s.archived, N'N') <> N'Y'
  AND ISNULL(s.modify_state, N'N') <> N'Y' AND ISNULL(s.effective, N'N') <> N'Y'
  AND ISNULL(hh.[工单号], N'') = N'' AND ISNULL(hh.[产品编码], N'') = N''
  AND ISNULL(hh.[检验员], N'') = N'' AND ISNULL(hh.[批次号], N'') = N''
  AND ISNULL(hh.[报工数量], 0) = 0
  AND NOT EXISTS (SELECT 1 FROM dbo.qc_proc_insp_detail x
                  WHERE x.[单据编号] = hh.[单据编号]
                    AND (ISNULL(x.[实测数值], N'') <> N'' OR ISNULL(x.[结果判断], N'') <> N''
                         OR ISNULL(x.[不良数量], 0) > 0));

INSERT INTO #f (no)
SELECT hh.[单据编号]
FROM dbo.qc_first_insp_head hh
LEFT JOIN dbo.yj_doc_status s ON s.panel_code = N'QC_FIRST_INSP' AND s.doc_no = hh.[单据编号]
WHERE ISNULL(hh.asp_cancel, N'N') <> N'Y'
  AND ISNULL(s.shr, N'') = N'' AND ISNULL(s.pending, N'N') <> N'Y' AND ISNULL(s.canceled, N'N') <> N'Y'
  AND ISNULL(s.stopped, N'N') <> N'Y' AND ISNULL(s.deleting, N'N') <> N'Y' AND ISNULL(s.archived, N'N') <> N'Y'
  AND ISNULL(s.modify_state, N'N') <> N'Y' AND ISNULL(s.effective, N'N') <> N'Y'
  AND ISNULL(hh.[工单号], N'') = N'' AND ISNULL(hh.[产品编码], N'') = N''
  AND ISNULL(hh.[检验员], N'') = N'' AND ISNULL(hh.[批次号], N'') = N''
  AND ISNULL(hh.[生产日期], N'') = N'' AND ISNULL(hh.[报工数量], 0) = 0
  AND NOT EXISTS (SELECT 1 FROM dbo.qc_first_insp_detail x
                  WHERE x.[单据编号] = hh.[单据编号]
                    AND (ISNULL(x.[实测数值], N'') <> N'' OR ISNULL(x.[结果判断], N'') <> N''));

DECLARE @p int = (SELECT COUNT(*) FROM #p);
DECLARE @f int = (SELECT COUNT(*) FROM #f);
DECLARE @sum int = @p + @f;
PRINT N'[1] 目标:制程 ' + CAST(@p AS nvarchar(10)) + N' 张 / 首件 ' + CAST(@f AS nvarchar(10))
      + N' 张(合计 ' + CAST(@sum AS nvarchar(10)) + N' 张,期望 ' + CAST(@expect AS nvarchar(10)) + N' 张)';
IF @sum <> @expect
BEGIN
  RAISERROR(N'[FAIL] 目标数应为 %d 张,实际 %d 张(制程 %d + 首件 %d)—— 口径已变或已清理过,先人工核对',
            16, 1, @expect, @sum, @p, @f);
  RETURN;
END

/* ── 2. 整行快照(可回滚) ── */
IF OBJECT_ID('_bak_qcdraft_proc_head_20261021')   IS NOT NULL DROP TABLE _bak_qcdraft_proc_head_20261021;
IF OBJECT_ID('_bak_qcdraft_proc_detail_20261021') IS NOT NULL DROP TABLE _bak_qcdraft_proc_detail_20261021;
IF OBJECT_ID('_bak_qcdraft_proc_status_20261021') IS NOT NULL DROP TABLE _bak_qcdraft_proc_status_20261021;
IF OBJECT_ID('_bak_qcdraft_fst_head_20261021')    IS NOT NULL DROP TABLE _bak_qcdraft_fst_head_20261021;
IF OBJECT_ID('_bak_qcdraft_fst_detail_20261021')  IS NOT NULL DROP TABLE _bak_qcdraft_fst_detail_20261021;
IF OBJECT_ID('_bak_qcdraft_fst_status_20261021')  IS NOT NULL DROP TABLE _bak_qcdraft_fst_status_20261021;
IF OBJECT_ID('_bak_qcdraft_approval_20261021')    IS NOT NULL DROP TABLE _bak_qcdraft_approval_20261021;

SELECT * INTO _bak_qcdraft_proc_head_20261021   FROM dbo.qc_proc_insp_head  WHERE [单据编号] IN (SELECT no FROM #p);
SELECT * INTO _bak_qcdraft_proc_detail_20261021 FROM dbo.qc_proc_insp_detail WHERE [单据编号] IN (SELECT no FROM #p);
SELECT * INTO _bak_qcdraft_proc_status_20261021 FROM dbo.yj_doc_status
 WHERE panel_code = N'QC_PROC_INSP' AND doc_no IN (SELECT no FROM #p);
SELECT * INTO _bak_qcdraft_fst_head_20261021    FROM dbo.qc_first_insp_head  WHERE [单据编号] IN (SELECT no FROM #f);
SELECT * INTO _bak_qcdraft_fst_detail_20261021  FROM dbo.qc_first_insp_detail WHERE [单据编号] IN (SELECT no FROM #f);
SELECT * INTO _bak_qcdraft_fst_status_20261021  FROM dbo.yj_doc_status
 WHERE panel_code = N'QC_FIRST_INSP' AND doc_no IN (SELECT no FROM #f);
SELECT * INTO _bak_qcdraft_approval_20261021    FROM dbo.yj_form_approval
 WHERE (panel_code = N'QC_PROC_INSP'  AND form_no IN (SELECT no FROM #p))
    OR (panel_code = N'QC_FIRST_INSP' AND form_no IN (SELECT no FROM #f));
PRINT N'[2] 快照已落表(_bak_qcdraft_*_20261021)';

/* ── 3. 单事务删除 ── */
BEGIN TRAN;

/* 3a 占用链 / 批次台账 / 附件 / 批注(实测本批均为 0,留着语句保证口径完整) */
DELETE FROM dbo.form_flow_link
 WHERE (source_panel_code = N'QC_PROC_INSP'  AND source_form_no IN (SELECT no FROM #p))
    OR (target_panel_code = N'QC_PROC_INSP'  AND target_form_no IN (SELECT no FROM #p))
    OR (source_panel_code = N'QC_FIRST_INSP' AND source_form_no IN (SELECT no FROM #f))
    OR (target_panel_code = N'QC_FIRST_INSP' AND target_form_no IN (SELECT no FROM #f));

DELETE FROM dbo.yj_doc_batch
 WHERE (target_panel_code = N'QC_PROC_INSP'  AND target_form_no IN (SELECT no FROM #p))
    OR (target_panel_code = N'QC_FIRST_INSP' AND target_form_no IN (SELECT no FROM #f));

DELETE FROM dbo.yj_attachment
 WHERE (panel_code = N'QC_PROC_INSP'  AND doc_no IN (SELECT no FROM #p))
    OR (panel_code = N'QC_FIRST_INSP' AND doc_no IN (SELECT no FROM #f));

DELETE FROM dbo.yj_doc_annotation
 WHERE (panel_code = N'QC_PROC_INSP'  AND doc_no IN (SELECT no FROM #p))
    OR (panel_code = N'QC_FIRST_INSP' AND doc_no IN (SELECT no FROM #f));

/* 3b 审批留痕 / 单据状态 */
DELETE FROM dbo.yj_form_approval
 WHERE (panel_code = N'QC_PROC_INSP'  AND form_no IN (SELECT no FROM #p))
    OR (panel_code = N'QC_FIRST_INSP' AND form_no IN (SELECT no FROM #f));

DELETE FROM dbo.yj_doc_status
 WHERE (panel_code = N'QC_PROC_INSP'  AND doc_no IN (SELECT no FROM #p))
    OR (panel_code = N'QC_FIRST_INSP' AND doc_no IN (SELECT no FROM #f));

/* 3c 明细(本批命中单无填过的明细行 ⇒ 这里只会删掉自动预铺的空标准行) */
DELETE FROM dbo.qc_proc_insp_detail  WHERE [单据编号] IN (SELECT no FROM #p);
DELETE FROM dbo.qc_first_insp_detail WHERE [单据编号] IN (SELECT no FROM #f);

/* 3d 单头 */
DELETE FROM dbo.qc_proc_insp_head  WHERE [单据编号] IN (SELECT no FROM #p);
DELETE FROM dbo.qc_first_insp_head WHERE [单据编号] IN (SELECT no FROM #f);

COMMIT TRAN;

/* ── 4. 收尾自检:命中单必须已不存在 ── */
DECLARE @left int =
  (SELECT COUNT(*) FROM dbo.qc_proc_insp_head  WHERE [单据编号] IN (SELECT no FROM #p))
+ (SELECT COUNT(*) FROM dbo.qc_first_insp_head WHERE [单据编号] IN (SELECT no FROM #f));
IF @left <> 0
BEGIN
  RAISERROR(N'[FAIL] 清理后仍有 %d 张残留 —— 请用 _bak_qcdraft_*_20261021 核对', 16, 1, @left);
  RETURN;
END
PRINT N'[3] 已删除:制程 ' + CAST(@p AS nvarchar(10)) + N' 张 / 首件 ' + CAST(@f AS nvarchar(10)) + N' 张';
PRINT N'[4] 收尾自检通过(残留 0)';

/* ── 5. 清理后存量 ── */
SELECT
  (SELECT COUNT(*) FROM dbo.qc_proc_insp_head  WHERE ISNULL(asp_cancel,N'N')<>'Y') AS 制程_剩余,
  (SELECT COUNT(*) FROM dbo.qc_first_insp_head WHERE ISNULL(asp_cancel,N'N')<>'Y') AS 首件_剩余;
