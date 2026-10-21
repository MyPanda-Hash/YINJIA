/* ============================================================
   _align-qc-catalog-rec-20261021.sql
   按「当前来料检验单」对齐「检验目录 + 检验数据记录」的脏数据
   (2026-10-21 用户口径:根据当前的来料检验单的数据对这个当前检验目录和检验数据
    记录的脏数据进行处理;用户选定口径 A「全量对齐现存检验单」)

   背景(为什么会有脏数据):
     2026-10-20 `_qc-insp-reset-20261020/_reset-qc-insp-demo-20261020.sql` 删掉了
     99 张演示/无来源来料检验单,但当时只连带清理了 qc_insp / qc_insp_detail /
     yj_doc_status / yj_form_approval / form_flow_link —— **检验目录(qc_catalog_detail)
     与检验数据记录(qc_insp_rec)没有跟着清**,于是留下一批指向已删检验单的悬空行。

   判定口径(唯一真源 = 未作废的来料检验单 + 未作废的明细行):
     · 检验目录行保留条件:检验单号仍存在且未作废,且该物料编码在同单未作废明细里;
     · 检验数据记录保留条件:来料检验单号仍存在且未作废,且该物料编码在同单未作废明细里;
       同一单号多条记录只保留 id 最小的一条(重号去重);
     · 其余全部删除(含:指向已删检验单、无任何关联的手工行、空白记录、重号记录)。

   实测目标(两账套):
     HSDZ_MES      目录删 46 行(52→6),记录删 32 行(38→6);
                   另补 1 行目录 + 1 条记录给缺失的 IJ-2026-09-0152 ⇒ 目录 7 / 记录 7。
     HSDZ_MES_TEST 目录删 28 行(28→0),记录删 28 行(28→0)—— 测试库是旧快照,
                   其来料检验单与正式库不同源,本次只做「删孤儿」,不按正式库补行。

   连带清理(只针对被删记录/目录行):
     qc_insp_rec_detail、yj_doc_status(QC_INSP_REC)、yj_form_approval(QC_INSP_REC)、
     form_flow_link、yj_attachment、yj_doc_annotation;
     qc_tc_in.检验数据记录单号 指向已删记录的置 NULL(断链修复,不删特采单)。

   安全:
     · 先整行快照 `_bak_qccat_detail_20261021` / `_bak_qcrec_20261021` /
       `_bak_qcrec_detail_20261021` / `_bak_qcrec_status_20261021` /
       `_bak_qcrec_approval_20261021` / `_bak_qctcin_ref_20261021`;
     · 目标数必须等于各账套实测值,否则 RAISERROR 中止(防口径漂移/误删);
     · 全程单事务(SET XACT_ABORT ON),失败整体回滚;
     · 幂等:已对齐后重跑,目标数 0/0 ⇒ 打印 PASS 直接返回(不会二次删、不会覆盖快照)。

   执行(两账套各一次,先正式后测试):
     cd tools
     java -cp lib\mssql-jdbc.jar SqlRunner.java "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false" yinjia <密码> archive\_qc-catalog-clean-20261021\_align-qc-catalog-rec-20261021.sql
     java ... databaseName=HSDZ_MES_TEST ... 同上

   回滚(快照表未 DROP 时):
     INSERT INTO qc_catalog_detail SELECT * FROM _bak_qccat_detail_20261021;
     INSERT INTO qc_insp_rec        SELECT * FROM _bak_qcrec_20261021;
     INSERT INTO qc_insp_rec_detail SELECT * FROM _bak_qcrec_detail_20261021;
     INSERT INTO yj_doc_status      SELECT * FROM _bak_qcrec_status_20261021;
     INSERT INTO yj_form_approval   SELECT * FROM _bak_qcrec_approval_20261021;
   ============================================================ */
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @db sysname = DB_NAME();
DECLARE @expCat int, @expRec int;
IF @db = N'HSDZ_MES'
BEGIN SET @expCat = 46; SET @expRec = 32; END
ELSE IF @db = N'HSDZ_MES_TEST'
BEGIN SET @expCat = 28; SET @expRec = 28; END
ELSE
BEGIN
    RAISERROR(N'[FAIL] 未知账套 %s —— 本脚本只允许在 HSDZ_MES / HSDZ_MES_TEST 执行', 16, 1, @db);
    RETURN;
END

/* ── 1. 算目标 ───────────────────────────────────────────────
   保留集 = 未作废检验单 + 未作废明细(单据编号, 物料编码)配对。
   目录:不满足保留集 ⇒ 删。
   记录:不满足保留集,或同一单号不是最小 id ⇒ 删。 */
IF OBJECT_ID('tempdb..#cat') IS NOT NULL DROP TABLE #cat;
IF OBJECT_ID('tempdb..#rec') IS NOT NULL DROP TABLE #rec;
CREATE TABLE #cat (id int NOT NULL PRIMARY KEY);
CREATE TABLE #rec (id int NOT NULL PRIMARY KEY, doc_no nvarchar(60) NOT NULL);

INSERT INTO #cat (id)
SELECT d.id
FROM dbo.qc_catalog_detail d
WHERE ISNULL(d.asp_cancel, N'N') <> N'Y'
  AND NOT EXISTS (
      SELECT 1
      FROM dbo.qc_insp h
      JOIN dbo.qc_insp_detail dt ON dt.单据编号 = h.单据编号
      WHERE h.单据编号 = d.检验单号 AND ISNULL(h.asp_cancel, N'N') <> N'Y'
        AND dt.物料编码 = d.物料编码 AND ISNULL(dt.asp_cancel, N'N') <> N'Y');

/* 保留集:能对上未作废检验单+明细的记录中,每个记录单号只留 id 最小的一条(重号去重)。
   ⚠ 去重必须只在「有效记录」内部做 —— 若把无效的重号行也纳入 MIN 比较,
   JYSJ-2026-10-0001 的旧行(id 较小但物料对不上)会把有效行一起拖下水(2026-10-21 实测)。 */
IF OBJECT_ID('tempdb..#keep') IS NOT NULL DROP TABLE #keep;
CREATE TABLE #keep (id int NOT NULL PRIMARY KEY);
INSERT INTO #keep (id)
SELECT MIN(r.id)
FROM dbo.qc_insp_rec r
WHERE ISNULL(r.asp_cancel, N'N') <> N'Y'
  AND EXISTS (
      SELECT 1
      FROM dbo.qc_insp h
      JOIN dbo.qc_insp_detail dt ON dt.单据编号 = h.单据编号
      WHERE h.单据编号 = r.来料检验单号 AND ISNULL(h.asp_cancel, N'N') <> N'Y'
        AND dt.物料编码 = r.物料编码 AND ISNULL(dt.asp_cancel, N'N') <> N'Y')
GROUP BY r.单据编号;

INSERT INTO #rec (id, doc_no)
SELECT r.id, r.单据编号
FROM dbo.qc_insp_rec r
WHERE ISNULL(r.asp_cancel, N'N') <> N'Y'
  AND r.id NOT IN (SELECT id FROM #keep);

DECLARE @nCat int = (SELECT COUNT(*) FROM #cat);
DECLARE @nRec int = (SELECT COUNT(*) FROM #rec);
PRINT N'[1] 目标: 目录 ' + CAST(@nCat AS nvarchar(10)) + N' 行 / 记录 ' + CAST(@nRec AS nvarchar(10)) + N' 行';

IF @nCat = 0 AND @nRec = 0
BEGIN
    PRINT N'[PASS] 已对齐,无脏行,无需处理';
    RETURN;
END
IF @nCat <> @expCat OR @nRec <> @expRec
BEGIN
    RAISERROR(N'[FAIL] 目标数与实测不符(期望 目录 %d / 记录 %d,实际 目录 %d / 记录 %d) —— 口径已变,先人工核对再执行',
              16, 1, @expCat, @expRec, @nCat, @nRec);
    RETURN;
END

/* ── 2. 整行快照(只建一次,重跑不覆盖) ─────────────────────── */
IF OBJECT_ID('_bak_qccat_detail_20261021') IS NULL
    SELECT * INTO _bak_qccat_detail_20261021 FROM dbo.qc_catalog_detail WHERE id IN (SELECT id FROM #cat);
IF OBJECT_ID('_bak_qcrec_20261021') IS NULL
    SELECT * INTO _bak_qcrec_20261021 FROM dbo.qc_insp_rec WHERE id IN (SELECT id FROM #rec);
IF OBJECT_ID('_bak_qcrec_detail_20261021') IS NULL
    SELECT * INTO _bak_qcrec_detail_20261021 FROM dbo.qc_insp_rec_detail
    WHERE 单据编号 IN (SELECT doc_no FROM #rec);
IF OBJECT_ID('_bak_qcrec_status_20261021') IS NULL
    SELECT * INTO _bak_qcrec_status_20261021 FROM dbo.yj_doc_status WHERE panel_code = N'QC_INSP_REC';
IF OBJECT_ID('_bak_qcrec_approval_20261021') IS NULL
    SELECT * INTO _bak_qcrec_approval_20261021 FROM dbo.yj_form_approval WHERE panel_code = N'QC_INSP_REC';
IF OBJECT_ID('_bak_qctcin_ref_20261021') IS NULL
    SELECT * INTO _bak_qctcin_ref_20261021 FROM dbo.qc_tc_in WHERE ISNULL(检验数据记录单号, N'') <> N'';

DECLARE @bkCat int = (SELECT COUNT(*) FROM _bak_qccat_detail_20261021);
DECLARE @bkRec int = (SELECT COUNT(*) FROM _bak_qcrec_20261021);
DECLARE @bkDetail int = (SELECT COUNT(*) FROM _bak_qcrec_detail_20261021);
DECLARE @bkStatus int = (SELECT COUNT(*) FROM _bak_qcrec_status_20261021);
DECLARE @bkApproval int = (SELECT COUNT(*) FROM _bak_qcrec_approval_20261021);
PRINT N'[2] 快照: 目录 ' + CAST(@bkCat AS nvarchar(10))
    + N' / 记录 ' + CAST(@bkRec AS nvarchar(10))
    + N' / 记录明细 ' + CAST(@bkDetail AS nvarchar(10))
    + N' / 状态 ' + CAST(@bkStatus AS nvarchar(10))
    + N' / 审批 ' + CAST(@bkApproval AS nvarchar(10));

/* ── 3. 单事务删除 + 断链修复 ──────────────────────────────── */
BEGIN TRAN;

DELETE x FROM dbo.qc_insp_rec_detail x WHERE x.单据编号 IN (SELECT doc_no FROM #rec);
PRINT N'[3] qc_insp_rec_detail 删除 ' + CAST(@@ROWCOUNT AS nvarchar(10));

DELETE d FROM dbo.qc_catalog_detail d WHERE d.id IN (SELECT id FROM #cat);
PRINT N'[4] qc_catalog_detail 删除 ' + CAST(@@ROWCOUNT AS nvarchar(10));

DELETE r FROM dbo.qc_insp_rec r WHERE r.id IN (SELECT id FROM #rec);
PRINT N'[5] qc_insp_rec 删除 ' + CAST(@@ROWCOUNT AS nvarchar(10));

DELETE s FROM dbo.yj_doc_status s
WHERE s.panel_code = N'QC_INSP_REC'
  AND NOT EXISTS (SELECT 1 FROM dbo.qc_insp_rec r WHERE r.单据编号 = s.doc_no AND ISNULL(r.asp_cancel, N'N') <> N'Y');
PRINT N'[6] yj_doc_status(QC_INSP_REC) 删除 ' + CAST(@@ROWCOUNT AS nvarchar(10));

DELETE a FROM dbo.yj_form_approval a
WHERE a.panel_code = N'QC_INSP_REC'
  AND NOT EXISTS (SELECT 1 FROM dbo.qc_insp_rec r WHERE r.单据编号 = a.form_no AND ISNULL(r.asp_cancel, N'N') <> N'Y');
PRINT N'[7] yj_form_approval(QC_INSP_REC) 删除 ' + CAST(@@ROWCOUNT AS nvarchar(10));

DELETE l FROM dbo.form_flow_link l
WHERE (l.source_panel_code = N'QC_INSP_REC'
       AND NOT EXISTS (SELECT 1 FROM dbo.qc_insp_rec r WHERE r.单据编号 = l.source_form_no AND ISNULL(r.asp_cancel, N'N') <> N'Y'))
   OR (l.target_panel_code = N'QC_INSP_REC'
       AND NOT EXISTS (SELECT 1 FROM dbo.qc_insp_rec r WHERE r.单据编号 = l.target_form_no AND ISNULL(r.asp_cancel, N'N') <> N'Y'));
PRINT N'[8] form_flow_link 删除 ' + CAST(@@ROWCOUNT AS nvarchar(10));

DELETE t FROM dbo.yj_attachment t
WHERE t.panel_code IN (N'QC_INSP_REC', N'QC_CATALOG')
  AND ((t.panel_code = N'QC_INSP_REC'
        AND NOT EXISTS (SELECT 1 FROM dbo.qc_insp_rec r WHERE r.单据编号 = t.doc_no AND ISNULL(r.asp_cancel, N'N') <> N'Y'))
    OR (t.panel_code = N'QC_CATALOG'
        AND NOT EXISTS (SELECT 1 FROM dbo.qc_catalog c WHERE c.单据编号 = t.doc_no AND ISNULL(c.asp_cancel, N'N') <> N'Y')));
PRINT N'[9] yj_attachment 删除 ' + CAST(@@ROWCOUNT AS nvarchar(10));

DELETE t FROM dbo.yj_doc_annotation t
WHERE t.panel_code IN (N'QC_INSP_REC', N'QC_CATALOG')
  AND ((t.panel_code = N'QC_INSP_REC'
        AND NOT EXISTS (SELECT 1 FROM dbo.qc_insp_rec r WHERE r.单据编号 = t.doc_no AND ISNULL(r.asp_cancel, N'N') <> N'Y'))
    OR (t.panel_code = N'QC_CATALOG'
        AND NOT EXISTS (SELECT 1 FROM dbo.qc_catalog c WHERE c.单据编号 = t.doc_no AND ISNULL(c.asp_cancel, N'N') <> N'Y')));
PRINT N'[10] yj_doc_annotation 删除 ' + CAST(@@ROWCOUNT AS nvarchar(10));

UPDATE t SET t.检验数据记录单号 = NULL
FROM dbo.qc_tc_in t
WHERE ISNULL(t.检验数据记录单号, N'') <> N''
  AND NOT EXISTS (SELECT 1 FROM dbo.qc_insp_rec r WHERE r.单据编号 = t.检验数据记录单号 AND ISNULL(r.asp_cancel, N'N') <> N'Y');
PRINT N'[11] qc_tc_in 断链置空 ' + CAST(@@ROWCOUNT AS nvarchar(10));

/* 重号遗留状态:JYSJ-2026-10-0001 的旧行(id 52)在 2026-10-04 提交过,
   与新行(id 138,2026-10-19 建)共用同一条 yj_doc_status ⇒ 新行无辜显示「审批中」。
   判据:状态行的 pending_at 早于记录行创建时间 asp_time1,且没有对应审批流水 ⇒ 清除 pending。 */
UPDATE s
SET s.pending = N'N', s.pending_by = NULL, s.pending_at = NULL, s.update_at = GETDATE()
FROM dbo.yj_doc_status s
JOIN dbo.qc_insp_rec r ON r.单据编号 = s.doc_no AND ISNULL(r.asp_cancel, N'N') <> N'Y'
WHERE s.panel_code = N'QC_INSP_REC'
  AND ISNULL(s.pending, N'N') = N'Y'
  AND r.asp_time1 IS NOT NULL
  AND s.pending_at < r.asp_time1
  AND NOT EXISTS (SELECT 1 FROM dbo.yj_form_approval a
                  WHERE a.panel_code = N'QC_INSP_REC' AND a.form_no = s.doc_no);
PRINT N'[11b] 重号遗留 pending 状态清除 ' + CAST(@@ROWCOUNT AS nvarchar(10));

COMMIT;

/* ── 4. 保留行按检验单回正(数量/单位/批次/名称/类别) ───────── */
UPDATE d
SET d.检测物料类别 = ISNULL((SELECT TOP 1 b.所属类别 FROM dbo.bs_inv b WHERE b.存货编码 = dt.物料编码 ORDER BY b.id), d.检测物料类别),
    d.物料名称 = dt.物料名称,
    d.批次号 = COALESCE(NULLIF(dt.批次号, N''), NULLIF(h.批次号, N'')),
    d.数量 = CASE WHEN dt.送检数量 IS NULL THEN d.数量
                  ELSE COALESCE(FORMAT(dt.送检数量, N'0.####'), N'')
                       + COALESCE(NULLIF(dt.单位, N''), NULLIF(dt.计量单位, N''), N'') END,
    d.计量单位 = COALESCE(NULLIF(dt.单位, N''), NULLIF(dt.计量单位, N''), d.计量单位),
    d.asp_user2 = N'qc-align-20261021', d.asp_time2 = GETDATE()
FROM dbo.qc_catalog_detail d
JOIN dbo.qc_insp h ON h.单据编号 = d.检验单号 AND ISNULL(h.asp_cancel, N'N') <> N'Y'
JOIN dbo.qc_insp_detail dt ON dt.单据编号 = h.单据编号 AND dt.物料编码 = d.物料编码 AND ISNULL(dt.asp_cancel, N'N') <> N'Y'
WHERE ISNULL(d.asp_cancel, N'N') <> N'Y';
PRINT N'[12] 目录保留行回正 ' + CAST(@@ROWCOUNT AS nvarchar(10));

UPDATE r
SET r.物料名称 = dt.物料名称,
    r.物料批次 = COALESCE(NULLIF(dt.批次号, N''), NULLIF(h.批次号, N'')),
    r.来料数量 = CASE WHEN dt.送检数量 IS NULL THEN r.来料数量
                     ELSE COALESCE(FORMAT(dt.送检数量, N'0.####'), N'')
                          + COALESCE(NULLIF(dt.单位, N''), NULLIF(dt.计量单位, N''), N'') END,
    r.计量单位 = COALESCE(NULLIF(dt.单位, N''), NULLIF(dt.计量单位, N''), r.计量单位),
    r.asp_user2 = N'qc-align-20261021', r.asp_time2 = GETDATE()
FROM dbo.qc_insp_rec r
JOIN dbo.qc_insp h ON h.单据编号 = r.来料检验单号 AND ISNULL(h.asp_cancel, N'N') <> N'Y'
JOIN dbo.qc_insp_detail dt ON dt.单据编号 = h.单据编号 AND dt.物料编码 = r.物料编码 AND ISNULL(dt.asp_cancel, N'N') <> N'Y'
WHERE ISNULL(r.asp_cancel, N'N') <> N'Y';
PRINT N'[13] 记录保留行回正 ' + CAST(@@ROWCOUNT AS nvarchar(10));

/* ── 5. 补 IJ-2026-09-0152 缺失的目录行 + 检验数据记录 ────────
   该单是现存真实链路单(暂收 SL-2026-09-0189),但目录/记录都没生成;
   正式库才有此单,测试库 EXISTS 不命中自然跳过。 */
DECLARE @bfInsp nvarchar(60) = N'IJ-2026-09-0152';
DECLARE @bfMat nvarchar(100) = N'YJ-KBL-021';
DECLARE @bfRec nvarchar(60);

IF EXISTS (SELECT 1 FROM dbo.qc_insp h JOIN dbo.qc_insp_detail dt ON dt.单据编号 = h.单据编号
           WHERE h.单据编号 = @bfInsp AND ISNULL(h.asp_cancel, N'N') <> N'Y'
             AND dt.物料编码 = @bfMat AND ISNULL(dt.asp_cancel, N'N') <> N'Y')
BEGIN
    SELECT TOP 1 @bfRec = r.单据编号 FROM dbo.qc_insp_rec r
    WHERE r.来料检验单号 = @bfInsp AND r.物料编码 = @bfMat AND ISNULL(r.asp_cancel, N'N') <> N'Y'
    ORDER BY r.id;

    IF @bfRec IS NULL
    BEGIN
        DECLARE @ny varchar(7) = FORMAT(GETDATE(), N'yyyy-MM');
        DECLARE @seq int = ISNULL((SELECT MAX(CAST(RIGHT(dh, 4) AS int)) FROM dbo.s_allno
                                   WHERE lb = N'JYSJ' AND ny = @ny AND dh LIKE N'JYSJ-' + @ny + N'-%'), 0);
        DECLARE @seq2 int = ISNULL((SELECT MAX(TRY_CAST(RIGHT(单据编号, 4) AS int)) FROM dbo.qc_insp_rec
                                    WHERE 单据编号 LIKE N'JYSJ-' + @ny + N'-%'), 0);
        SET @seq = CASE WHEN @seq2 > @seq THEN @seq2 ELSE @seq END;

        WHILE 1 = 1
        BEGIN
            SET @seq = @seq + 1;
            SET @bfRec = N'JYSJ-' + @ny + N'-' + RIGHT(N'0000' + CAST(@seq AS nvarchar(4)), 4);
            IF NOT EXISTS (SELECT 1 FROM dbo.s_allno WHERE dh = @bfRec)
               AND NOT EXISTS (SELECT 1 FROM dbo.qc_insp_rec WHERE 单据编号 = @bfRec)
                BREAK;
        END

        INSERT INTO dbo.s_allno (comm, dh, lb, ny, asp_user1, asp_time1, asp_cancel)
        VALUES (N'0', @bfRec, N'JYSJ', @ny, N'admin', GETDATE(), N'N');

        INSERT INTO dbo.qc_insp_rec (单据编号, 单据日期, 物料名称, 物料编码, 物料批次, 检验日期,
                                     来料数量, 计量单位, 文件编码, 检验依据, 检验人, 表单审核人,
                                     来料检验单号, asp_user1, asp_time1)
        SELECT @bfRec, h.单据日期, dt.物料名称, dt.物料编码,
               COALESCE(NULLIF(dt.批次号, N''), NULLIF(h.批次号, N'')),
               COALESCE(NULLIF(h.检验日期, N''), h.单据日期),
               COALESCE(FORMAT(dt.送检数量, N'0.####'), N'') + COALESCE(NULLIF(dt.单位, N''), NULLIF(dt.计量单位, N''), N''),
               COALESCE(NULLIF(dt.单位, N''), NULLIF(dt.计量单位, N'')),
               N'YJ-QR-96', N'YJ-Q-30', N'admin', N'冯敏', @bfInsp, N'admin', GETDATE()
        FROM dbo.qc_insp h JOIN dbo.qc_insp_detail dt ON dt.单据编号 = h.单据编号
        WHERE h.单据编号 = @bfInsp AND dt.物料编码 = @bfMat AND ISNULL(dt.asp_cancel, N'N') <> N'Y';

        MERGE dbo.yj_doc_status AS t
        USING (VALUES (@bfRec)) AS s(doc_no)
        ON t.panel_code = N'QC_INSP_REC' AND t.doc_no = s.doc_no
        WHEN NOT MATCHED THEN
            INSERT (panel_code, doc_no, canceled, saved, update_at)
            VALUES (N'QC_INSP_REC', s.doc_no, N'N', N'Y', GETDATE());

        PRINT N'[14] 补建检验数据记录 ' + @bfRec;
    END

    IF NOT EXISTS (SELECT 1 FROM dbo.qc_catalog_detail
                   WHERE 检验单号 = @bfInsp AND 物料编码 = @bfMat AND ISNULL(asp_cancel, N'N') <> N'Y')
    BEGIN
        DECLARE @catNo nvarchar(60) = (SELECT TOP 1 单据编号 FROM dbo.qc_catalog
                                       WHERE ISNULL(asp_cancel, N'N') <> N'Y' ORDER BY id);
        IF @catNo IS NOT NULL
        BEGIN
            INSERT INTO dbo.qc_catalog_detail (单据编号, 检测物料类别, 物料名称, 物料编码, 批次号, 数量,
                                               计量单位, 检验状态, 是否合格, 检验单号, 检验数据记录单号,
                                               asp_user1, asp_time1)
            SELECT @catNo,
                   ISNULL((SELECT TOP 1 b.所属类别 FROM dbo.bs_inv b WHERE b.存货编码 = dt.物料编码 ORDER BY b.id), N''),
                   dt.物料名称, dt.物料编码,
                   COALESCE(NULLIF(dt.批次号, N''), NULLIF(h.批次号, N'')),
                   COALESCE(FORMAT(dt.送检数量, N'0.####'), N'') + COALESCE(NULLIF(dt.单位, N''), NULLIF(dt.计量单位, N''), N''),
                   COALESCE(NULLIF(dt.单位, N''), NULLIF(dt.计量单位, N'')),
                   N'正在检验中', NULL, @bfInsp, @bfRec, N'admin', GETDATE()
            FROM dbo.qc_insp h JOIN dbo.qc_insp_detail dt ON dt.单据编号 = h.单据编号
            WHERE h.单据编号 = @bfInsp AND dt.物料编码 = @bfMat AND ISNULL(dt.asp_cancel, N'N') <> N'Y';

            PRINT N'[15] 补建检验目录行 ' + @bfInsp + N' / ' + @bfMat;
        END
    END
END

/* ── 6. 收尾自检 ──────────────────────────────────────────── */
SELECT N'qc_catalog_detail 剩余' AS k, COUNT(*) AS n FROM dbo.qc_catalog_detail WHERE ISNULL(asp_cancel, N'N') <> N'Y'
UNION ALL SELECT N'qc_insp_rec 剩余', COUNT(*) FROM dbo.qc_insp_rec WHERE ISNULL(asp_cancel, N'N') <> N'Y'
UNION ALL SELECT N'目录-悬空检验单', COUNT(*) FROM dbo.qc_catalog_detail d
          WHERE ISNULL(d.asp_cancel, N'N') <> N'Y'
            AND NOT EXISTS (SELECT 1 FROM dbo.qc_insp h WHERE h.单据编号 = d.检验单号 AND ISNULL(h.asp_cancel, N'N') <> N'Y')
UNION ALL SELECT N'目录-悬空记录', COUNT(*) FROM dbo.qc_catalog_detail d
          WHERE ISNULL(d.asp_cancel, N'N') <> N'Y'
            AND NOT EXISTS (SELECT 1 FROM dbo.qc_insp_rec r WHERE r.单据编号 = d.检验数据记录单号 AND ISNULL(r.asp_cancel, N'N') <> N'Y')
UNION ALL SELECT N'记录-悬空检验单', COUNT(*) FROM dbo.qc_insp_rec r
          WHERE ISNULL(r.asp_cancel, N'N') <> N'Y'
            AND NOT EXISTS (SELECT 1 FROM dbo.qc_insp h WHERE h.单据编号 = r.来料检验单号 AND ISNULL(h.asp_cancel, N'N') <> N'Y')
UNION ALL SELECT N'记录-重号', COUNT(*) FROM (SELECT 单据编号 FROM dbo.qc_insp_rec
          WHERE ISNULL(asp_cancel, N'N') <> N'Y' GROUP BY 单据编号 HAVING COUNT(*) > 1) x
UNION ALL SELECT N'状态(QC_INSP_REC) 剩余', COUNT(*) FROM dbo.yj_doc_status WHERE panel_code = N'QC_INSP_REC'
UNION ALL SELECT N'审批(QC_INSP_REC) 剩余', COUNT(*) FROM dbo.yj_form_approval WHERE panel_code = N'QC_INSP_REC';

SELECT d.检验单号, d.物料编码, d.物料名称, d.批次号, d.数量, d.计量单位, d.检验状态, d.检验数据记录单号
FROM dbo.qc_catalog_detail d WHERE ISNULL(d.asp_cancel, N'N') <> N'Y' ORDER BY d.检验单号, d.物料编码;
