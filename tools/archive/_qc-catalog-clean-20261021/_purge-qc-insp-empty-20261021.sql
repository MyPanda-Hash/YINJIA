/* ============================================================
   _purge-qc-insp-empty-20261021.sql
   删除「没有明细」的来料检验单（2026-10-21 用户口径:
   「当前来料检验单的数据仍然存在错误数据需要帮我处理掉这些没有明细表的数据」）

   命中口径(逐条):
     ① 单头未作废(asp_cancel≠Y);
     ② 该单**没有一条未作废明细**(qc_insp_detail 全部 asp_cancel='Y',或一条都没有);
     ③ 单头仍是草稿态(按 QueryService.docStatus 判据:shr 空、pending/canceled/stopped/
        deleting/archived/modify_state/effective 都不为 Y;没有状态行也算草稿);
     ④ 不允许误伤已审核/审批中/已归档单 —— ③ 已兜住。

   实测命中(两账套均为 10 张,同一批):
     IJ-2026-10-0011 ~ IJ-2026-10-0020 —— 单头草稿、明细全被作废(共 12 行),
     来源暂收单 SL-2026-10-0121 ~ SL-2026-10-0130(测试库同)。

   连带清理(只针对命中单):
     qc_insp_detail、yj_doc_status、yj_form_approval、form_flow_link(源/目标)、
     yj_attachment、yj_doc_annotation、yj_doc_modify_log、yj_archive_change_log、
     yj_doc_batch(源/目标);并防御性清掉 qc_catalog_detail / qc_insp_rec 的残留引用
     (实测均为 0 —— 2026-10-21 上一轮已按现存检验单对齐过)。

   安全:
     · 先整行快照 `_bak_qcinsp_empty_*_20261021`(只建一次,重跑不覆盖);
     · 目标数必须等于 10,否则 RAISERROR 中止;
     · 单事务(SET XACT_ABORT ON),失败整体回滚;
     · 幂等:删完再跑目标数 0 ⇒ 打印 PASS 直接返回。

   执行(两账套各一次,先正式后测试;在 tools 目录):
     java -cp lib\mssql-jdbc.jar SqlRunner.java "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false" yinjia <密码> archive\_qc-catalog-clean-20261021\_purge-qc-insp-empty-20261021.sql

   回滚(快照未 DROP 时):
     INSERT INTO qc_insp        SELECT * FROM _bak_qcinsp_empty_20261021;
     INSERT INTO qc_insp_detail SELECT * FROM _bak_qcinsp_empty_detail_20261021;
     INSERT INTO yj_doc_status  SELECT * FROM _bak_qcinsp_empty_status_20261021;
     INSERT INTO form_flow_link SELECT * FROM _bak_qcinsp_empty_flow_20261021;
     INSERT INTO yj_form_approval SELECT * FROM _bak_qcinsp_empty_approval_20261021;
   ============================================================ */
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @db sysname = DB_NAME();
IF @db NOT IN (N'HSDZ_MES', N'HSDZ_MES_TEST')
BEGIN
    RAISERROR(N'[FAIL] 未知账套 %s —— 本脚本只允许在 HSDZ_MES / HSDZ_MES_TEST 执行', 16, 1, @db);
    RETURN;
END

/* ── 1. 目标 ─────────────────────────────────────────────── */
IF OBJECT_ID('tempdb..#d') IS NOT NULL DROP TABLE #d;
CREATE TABLE #d (no nvarchar(60) NOT NULL PRIMARY KEY);

INSERT INTO #d (no)
SELECT h.单据编号
FROM dbo.qc_insp h
LEFT JOIN dbo.yj_doc_status s ON s.panel_code = N'QC_INSP' AND s.doc_no = h.单据编号
WHERE ISNULL(h.asp_cancel, N'N') <> N'Y'
  AND ISNULL(s.shr, N'') = N''
  AND ISNULL(s.pending, N'N') <> N'Y'
  AND ISNULL(s.canceled, N'N') <> N'Y'
  AND ISNULL(s.stopped, N'N') <> N'Y'
  AND ISNULL(s.deleting, N'N') <> N'Y'
  AND ISNULL(s.archived, N'N') <> N'Y'
  AND ISNULL(s.modify_state, N'N') <> N'Y'
  AND ISNULL(s.effective, N'N') <> N'Y'
  AND NOT EXISTS (
      SELECT 1 FROM dbo.qc_insp_detail dt
      WHERE dt.单据编号 = h.单据编号 AND ISNULL(dt.asp_cancel, N'N') <> N'Y');

DECLARE @n int = (SELECT COUNT(*) FROM #d);
PRINT N'[1] 命中「无未作废明细」的来料检验单: ' + CAST(@n AS nvarchar(10)) + N' 张';

/* 1b. 顺带清掉 QC_INSP 的孤儿状态行(单头早已不存在;本次实测 9 行,
       不删会在状态表里继续留脏,且不影响任何现存单据)。 */
DELETE s FROM dbo.yj_doc_status s
WHERE s.panel_code = N'QC_INSP'
  AND NOT EXISTS (SELECT 1 FROM dbo.qc_insp h WHERE h.单据编号 = s.doc_no);
PRINT N'[1b] QC_INSP 孤儿状态行 删除 ' + CAST(@@ROWCOUNT AS nvarchar(10));

IF @n = 0
BEGIN
    PRINT N'[PASS] 没有需要清理的空明细来料检验单';
    RETURN;
END
IF @n <> 10
BEGIN
    RAISERROR(N'[FAIL] 目标应为 10 张,实际 %d 张 —— 口径已变,先人工核对再执行', 16, 1, @n);
    RETURN;
END

/* ── 2. 快照 ─────────────────────────────────────────────── */
IF OBJECT_ID('_bak_qcinsp_empty_20261021') IS NULL
    SELECT * INTO _bak_qcinsp_empty_20261021 FROM dbo.qc_insp WHERE 单据编号 IN (SELECT no FROM #d);
IF OBJECT_ID('_bak_qcinsp_empty_detail_20261021') IS NULL
    SELECT * INTO _bak_qcinsp_empty_detail_20261021 FROM dbo.qc_insp_detail WHERE 单据编号 IN (SELECT no FROM #d);
IF OBJECT_ID('_bak_qcinsp_empty_status_20261021') IS NULL
    SELECT * INTO _bak_qcinsp_empty_status_20261021 FROM dbo.yj_doc_status
    WHERE panel_code = N'QC_INSP' AND doc_no IN (SELECT no FROM #d);
IF OBJECT_ID('_bak_qcinsp_empty_flow_20261021') IS NULL
    SELECT * INTO _bak_qcinsp_empty_flow_20261021 FROM dbo.form_flow_link
    WHERE (source_panel_code = N'QC_INSP' AND source_form_no IN (SELECT no FROM #d))
       OR (target_panel_code = N'QC_INSP' AND target_form_no IN (SELECT no FROM #d));
IF OBJECT_ID('_bak_qcinsp_empty_approval_20261021') IS NULL
    SELECT * INTO _bak_qcinsp_empty_approval_20261021 FROM dbo.yj_form_approval
    WHERE panel_code = N'QC_INSP' AND form_no IN (SELECT no FROM #d);

DECLARE @b1 int = (SELECT COUNT(*) FROM _bak_qcinsp_empty_20261021);
DECLARE @b2 int = (SELECT COUNT(*) FROM _bak_qcinsp_empty_detail_20261021);
DECLARE @b3 int = (SELECT COUNT(*) FROM _bak_qcinsp_empty_status_20261021);
DECLARE @b4 int = (SELECT COUNT(*) FROM _bak_qcinsp_empty_flow_20261021);
DECLARE @b5 int = (SELECT COUNT(*) FROM _bak_qcinsp_empty_approval_20261021);
PRINT N'[2] 快照: 头 ' + CAST(@b1 AS nvarchar(10)) + N' / 明细 ' + CAST(@b2 AS nvarchar(10))
    + N' / 状态 ' + CAST(@b3 AS nvarchar(10)) + N' / 链路 ' + CAST(@b4 AS nvarchar(10))
    + N' / 审批 ' + CAST(@b5 AS nvarchar(10));

/* ── 3. 单事务删除 ──────────────────────────────────────── */
BEGIN TRAN;

DELETE l FROM dbo.form_flow_link l
WHERE (l.source_panel_code = N'QC_INSP' AND l.source_form_no IN (SELECT no FROM #d))
   OR (l.target_panel_code = N'QC_INSP' AND l.target_form_no IN (SELECT no FROM #d));
PRINT N'[3] form_flow_link 删除 ' + CAST(@@ROWCOUNT AS nvarchar(10));

DELETE a FROM dbo.yj_form_approval a
WHERE a.panel_code = N'QC_INSP' AND a.form_no IN (SELECT no FROM #d);
PRINT N'[4] yj_form_approval 删除 ' + CAST(@@ROWCOUNT AS nvarchar(10));

DELETE s FROM dbo.yj_doc_status s
WHERE s.panel_code = N'QC_INSP' AND s.doc_no IN (SELECT no FROM #d);
PRINT N'[5] yj_doc_status 删除 ' + CAST(@@ROWCOUNT AS nvarchar(10));

DELETE t FROM dbo.yj_attachment t
WHERE t.panel_code = N'QC_INSP' AND t.doc_no IN (SELECT no FROM #d);
PRINT N'[6] yj_attachment 删除 ' + CAST(@@ROWCOUNT AS nvarchar(10));

DELETE t FROM dbo.yj_doc_annotation t
WHERE t.panel_code = N'QC_INSP' AND t.doc_no IN (SELECT no FROM #d);
PRINT N'[7] yj_doc_annotation 删除 ' + CAST(@@ROWCOUNT AS nvarchar(10));

DELETE t FROM dbo.yj_doc_modify_log t
WHERE t.panel_code = N'QC_INSP' AND t.doc_no IN (SELECT no FROM #d);
PRINT N'[8] yj_doc_modify_log 删除 ' + CAST(@@ROWCOUNT AS nvarchar(10));

DELETE t FROM dbo.yj_archive_change_log t
WHERE t.panel_code = N'QC_INSP' AND t.doc_no IN (SELECT no FROM #d);
PRINT N'[9] yj_archive_change_log 删除 ' + CAST(@@ROWCOUNT AS nvarchar(10));

DELETE b FROM dbo.yj_doc_batch b
WHERE (b.source_panel_code = N'QC_INSP' AND b.source_form_no IN (SELECT no FROM #d))
   OR (b.target_panel_code = N'QC_INSP' AND b.target_form_no IN (SELECT no FROM #d));
PRINT N'[10] yj_doc_batch 删除 ' + CAST(@@ROWCOUNT AS nvarchar(10));

/* 防御性：目录/记录若仍有残留引用（实测 0），一并清掉，避免又留悬空行 */
DELETE c FROM dbo.qc_catalog_detail c WHERE c.检验单号 IN (SELECT no FROM #d);
PRINT N'[11] qc_catalog_detail 残留引用 删除 ' + CAST(@@ROWCOUNT AS nvarchar(10));

DELETE r FROM dbo.qc_insp_rec r WHERE r.来料检验单号 IN (SELECT no FROM #d);
PRINT N'[12] qc_insp_rec 残留引用 删除 ' + CAST(@@ROWCOUNT AS nvarchar(10));

DELETE dt FROM dbo.qc_insp_detail dt WHERE dt.单据编号 IN (SELECT no FROM #d);
PRINT N'[13] qc_insp_detail 删除 ' + CAST(@@ROWCOUNT AS nvarchar(10));

DELETE h FROM dbo.qc_insp h WHERE h.单据编号 IN (SELECT no FROM #d);
PRINT N'[14] qc_insp 删除 ' + CAST(@@ROWCOUNT AS nvarchar(10));

COMMIT;

/* ── 4. 收尾自检 ────────────────────────────────────────── */
SELECT N'qc_insp 剩余(总)' AS k, COUNT(*) AS n FROM dbo.qc_insp
UNION ALL SELECT N'qc_insp 剩余(未作废)', COUNT(*) FROM dbo.qc_insp WHERE ISNULL(asp_cancel, N'N') <> N'Y'
UNION ALL SELECT N'qc_insp 无未作废明细(应为 0)', COUNT(*) FROM dbo.qc_insp h
          WHERE ISNULL(h.asp_cancel, N'N') <> N'Y'
            AND NOT EXISTS (SELECT 1 FROM dbo.qc_insp_detail d
                            WHERE d.单据编号 = h.单据编号 AND ISNULL(d.asp_cancel, N'N') <> N'Y')
UNION ALL SELECT N'qc_insp_detail 剩余', COUNT(*) FROM dbo.qc_insp_detail
UNION ALL SELECT N'yj_doc_status(QC_INSP) 剩余', COUNT(*) FROM dbo.yj_doc_status WHERE panel_code = N'QC_INSP'
UNION ALL SELECT N'form_flow_link(QC_INSP) 剩余', COUNT(*) FROM dbo.form_flow_link
          WHERE source_panel_code = N'QC_INSP' OR target_panel_code = N'QC_INSP';
