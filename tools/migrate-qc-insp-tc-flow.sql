/* ============================================================================
 * 来料检验「特采」开关 + 特采闸门链路(检验 → 特采单 → 采购入库)
 * ----------------------------------------------------------------------------
 * 用户口径(2026-09-22 定稿):
 *   ① 来料检验单明细加「特采」bool 开关(默认关);
 *   ② 勾了特采的行:检验单审核/审批通过时**不再**自动生成 采购入库单/暂收退回单,
 *      而是每个特采行生成一张特采单(QC_TC_IN,一物料一单),承载 合格+不合格 的全部数量
 *      (总数量=合格+不合格,不合格品数量=不合格数量,比例自动算);
 *   ③ 特采单「审核」= 审批通过,随即自动生成**一张采购入库单**(数量=特采单总数量,
 *      全部入库、不走退料 —— 特采=让步接收);
 *   ④ 闸门(自动+手工都拦):特采行在特采单审批前不得进入 采购入库单/暂收退回单 ——
 *      自动路径不生成;手工/推式路径(QC_INSP→PURCHASE_IN / QC_INSP→QC_RETURN)一律排除特采行;
 *   ⑤ 未勾特采的行行为完全不变(合格→入库草稿、不良→退回草稿)。
 *
 * 本脚本(幂等):
 *   ① qc_insp_detail 加 [特采] bit 默认 0 + 中文注明;
 *   ② qc_tc_in 加 [检验单号]/[批次键]/[批次号] 三列(隐藏链路列,纸面 YJ-QR-60 无此三项)
 *      + 中文注明;
 *   ③ yj_field 登记:QC_INSP 明细「特采」(是否=开关,seq 125,紧跟 不合格数量 之后);
 *      QC_TC_IN 头三个隐藏字段 批次键(900)/批次号(901)/检验单号(902);
 *   ④ yj_translation 补「特采」×10 语言(多语言强制规范);
 *   ⑤ 自检。
 * 配套代码(同提交):ButtonService(inspAutoPurchaseIn/inspAutoReturn 排除特采行、
 *   inspAutoSpecialAccept 生成特采单、tcInApprovedGenerate 特采审核→入库、弃审级联)、
 *   PushGenerateHandler(QC_INSP→PURCHASE_IN/QC_RETURN 生单拦特采行)、
 *   BatchService(批次号回填覆盖特采单头、去向优先级加 QC_TC_IN)。
 * ========================================================================== */

SET NOCOUNT ON;
GO

/* ---------- ① 检验明细:特采开关 ---------- */
IF COL_LENGTH('dbo.qc_insp_detail', N'特采') IS NULL
    ALTER TABLE dbo.qc_insp_detail ADD [特采] bit NOT NULL CONSTRAINT DF_qc_insp_detail_tc DEFAULT 0;
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
               WHERE major_id = OBJECT_ID('dbo.qc_insp_detail')
                 AND minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.qc_insp_detail'), N'特采', 'ColumnId')
                 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description',
        N'特采:勾选=该行走特采(让步接收)——检验审核不直接生成入库/退料,改为生成特采单;特采单审核通过后全部数量进采购入库单(不走退料)',
        N'SCHEMA', N'dbo', N'TABLE', N'qc_insp_detail', N'COLUMN', N'特采';
GO

/* ---------- ② 特采单:链路列(纸面 YJ-QR-60 无,隐藏) ---------- */
IF COL_LENGTH('dbo.qc_tc_in', N'检验单号') IS NULL ALTER TABLE dbo.qc_tc_in ADD [检验单号] nvarchar(60) NULL;
IF COL_LENGTH('dbo.qc_tc_in', N'批次键')  IS NULL ALTER TABLE dbo.qc_tc_in ADD [批次键] int NULL;
IF COL_LENGTH('dbo.qc_tc_in', N'批次号')  IS NULL ALTER TABLE dbo.qc_tc_in ADD [批次号] nvarchar(50) NULL;
GO
DECLARE @cm TABLE (col SYSNAME, txt NVARCHAR(400));
INSERT INTO @cm VALUES
 (N'检验单号', N'检验单号:生成本特采单的来料检验单(链路 QC_INSP→QC_TC_IN 的来源单号)'),
 (N'批次键',   N'批次键:批次台账 yj_doc_batch.id;由检验单带下,特采审核生成的采购入库单凭它回填批次号'),
 (N'批次号',   N'批次号:采购入库单审核时按批次键回填(纯入库日期 yyyyMMdd,同一日期同一批次)');
DECLARE @c SYSNAME, @x NVARCHAR(400);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT col, txt FROM @cm;
OPEN cur; FETCH NEXT FROM cur INTO @c, @x;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
                 WHERE major_id = OBJECT_ID('dbo.qc_tc_in')
                   AND minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.qc_tc_in'), @c, 'ColumnId')
                   AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', @x, N'SCHEMA', N'dbo', N'TABLE', N'qc_tc_in', N'COLUMN', @c;
  FETCH NEXT FROM cur INTO @c, @x;
END
CLOSE cur; DEALLOCATE cur;
GO

/* ---------- ③ yj_field 登记 ---------- */
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'QC_INSP' AND col_name = N'特采')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES ('QC_INSP', N'特采', N'特采', N'是否', N'detail', 125, 60, 1, 0, 0, 1);

DECLARE @tch TABLE (col SYSNAME, label NVARCHAR(50), dt NVARCHAR(10), seq INT);
INSERT INTO @tch VALUES (N'批次键', N'批次键', N'整数', 900), (N'批次号', N'批次号', N'文本', 901), (N'检验单号', N'检验单号', N'文本', 902);
INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
SELECT 'QC_TC_IN', t.col, t.label, t.dt, N'header', t.seq, 80, 0, 0, 1, 0
FROM @tch t
WHERE NOT EXISTS (SELECT 1 FROM yj_field x WHERE x.panel_code = 'QC_TC_IN' AND x.col_name = t.col);
GO

/* ---------- ④ 译名:特采 ×10 ---------- */
DECLARE @tr TABLE (loc NVARCHAR(5), txt NVARCHAR(200));
INSERT INTO @tr VALUES
 (N'en',    N'Special acceptance'),
 (N'ja',    N'特別採用'),
 (N'ko',    N'특채'),
 (N'zh-TW', N'特採'),
 (N'es',    N'Aceptación especial'),
 (N'fr',    N'Acceptation particulière'),
 (N'de',    N'Sonderabnahme'),
 (N'ru',    N'Особый приём'),
 (N'vi',    N'Chấp nhận đặc biệt'),
 (N'th',    N'การรับพิเศษ');
MERGE yj_translation AS t
USING (SELECT N'特采' AS k, loc, txt FROM @tr) AS s(k, loc, txt)
ON t.scope = 'field' AND t.ref_key = s.k AND t.locale = s.loc
WHEN NOT MATCHED THEN INSERT (scope, ref_key, locale, text, source) VALUES ('field', s.k, s.loc, s.txt, 'manual');
GO

/* ---------- ⑤ 自检 ---------- */
IF COL_LENGTH('dbo.qc_insp_detail', N'特采') IS NULL RAISERROR(N'qc_insp_detail.特采 未建', 16, 1);
IF COL_LENGTH('dbo.qc_tc_in', N'检验单号') IS NULL OR COL_LENGTH('dbo.qc_tc_in', N'批次键') IS NULL
   OR COL_LENGTH('dbo.qc_tc_in', N'批次号') IS NULL RAISERROR(N'qc_tc_in 链路列缺失', 16, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_INSP' AND col_name=N'特采' AND data_type=N'是否' AND hidden=0)
    RAISERROR(N'QC_INSP 明细字段「特采」未登记', 16, 1);
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code='QC_TC_IN' AND col_name IN (N'批次键',N'批次号',N'检验单号')
    AND hidden=1 AND visible=0 AND editable=0) <> 3 RAISERROR(N'QC_TC_IN 隐藏链路字段未登记齐', 16, 1);
IF (SELECT COUNT(*) FROM yj_translation WHERE scope='field' AND ref_key=N'特采') < 10
    RAISERROR(N'「特采」译名不足 10 语言', 16, 1);
PRINT N'✅ 特采链路迁移完成:检验明细特采开关 + 特采单链路列 + 字段登记 + 译名';
GO
