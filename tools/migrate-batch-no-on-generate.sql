/* ============================================================================
 * 采购链批次号口径变更:**入库审核取号回填 → 生单即定号**(2026-10-04 用户口径)
 * ----------------------------------------------------------------------------
 * 用户定稿口径(取代 2026-09-21 的「纯入库日期 + 入库审核确认并回填全链」):
 *   ① 批次号 = **供应商编码去掉 `YJ-` 前缀 + `-` + 生单当天 yyyyMMdd**
 *      (如 供应商 YJ-TX、生单日 2026-09-10 ⇒ `TX-20260910`;编码没有 YJ- 前缀时整串照用);
 *   ② **取号时机 = 生单那一刻**(采购订单 → 送料暂收单),下游(检验/入库/退回)**继承同一个号**,
 *      不重新取号;不再有"采购入库单审核时逆流回填上游"这一说;
 *   ③ 编码为空(历史脏单/未选供应商)时退回纯日期 `yyyyMMdd` —— 永不空号、不阻断生单;
 *   ④ **可编辑窗口**:只有送料暂收单**草稿态的「单头」**批次号可人工改;
 *      「送料暂收单审核」之后整链只读(下游各单的批次号一律不可改);
 *   ⑤ **头行一致**:单头批次号即明细行批次号(后端每次保存/审核都按单头覆盖写全部明细行,
 *      见 BatchService.syncBatchNo)—— 用户口径「包括下面的明细项目也需要做到批次号一致」;
 *   ⑥ 历史批次号(YJ-… / 20260921 / 10 位旧号)原样保留,不做历史数据订正;
 *      老单再次保存/审核时会顺链自愈取号(同一公式)。
 *
 * 本脚本(幂等)只做**元数据**改动 —— 字段可编辑口径 + 列中文注明:
 *   ① QC_RECV 单头 批次号 editable=1(草稿态可改;非草稿由整单编辑闸门锁死)
 *      —— 这是全链**唯一**的人工可改点;
 *   ② QC_RECV 明细 + QC_INSP/QC_RETURN/PURCHASE_IN 的头与明细 + QC_TC_IN 头:
 *      editable=0(随链继承/随单头,不可手改);
 *   ③ sl_recv / sl_recv_detail / qc_insp / qc_insp_detail / bd_purchase_in / bl_purchase_in /
 *      qc_return / qc_return_detail / qc_tc_in / yj_doc_batch 的批次号列中文注明改写成新口径;
 *   ④ 自检:逐条断言 editable 值 + 目标列注明已存在。
 *
 * ⚠ 与 migrate-batch-link.sql 的关系:该脚本原为无条件 DELETE+INSERT(editable 写死 1),
 *   已改为"只在缺失时插入"(见该文件 §5 的 2026-10-04 修),故本脚本的口径不会再被它覆盖;
 *   DbSync 按内容哈希重跑任何脚本都不影响本口径(幂等 SET 而非 INSERT)。
 *
 * 配套代码(同提交):
 *   · BatchService:buildBatchNo(取号公式)/ syncBatchNo(保存·审核时头行自洽 + 台账补齐);
 *     createPending→createBatch(生单即登记 ACTIVE 且已带号的台账);
 *     删除 assignNoAndBackfill / findPendingBatchId / backfill(回填机制整体移除);
 *   · PushGenerateHandler.generateBatch:头一跳取号、下游继承,单头+全部明细行同号;
 *     batchLines 增加 nextBatchNo(弹窗预告本批号);
 *   · ButtonService:删除入库审核回填钩子 assignBatchNoOnInbound,saveDoc/audit 改调 syncBatchNo;
 *     特采单生成入库单时带上批次号;
 *   · QcCatalogService:检验目录行与检验数据记录**建单即带号**,删除 refreshBatchNosFromInsp/backfillBatchNo;
 *   · 前端 docDefaults.js 删除采购入库单的批次号预设与「单据日期→批次号」联动;
 *     PanelxList 明细行批次号只读、BatchSendDialog 显示服务端预告的本批号。
 * ========================================================================== */

SET NOCOUNT ON;
GO

/* ---------- ① 字段可编辑口径 ---------- */
DECLARE @t TABLE (panel_code nvarchar(60), place nvarchar(30), label nvarchar(120), editable bit, why nvarchar(200));
INSERT INTO @t (panel_code, place, label, editable, why) VALUES
  (N'QC_RECV',     N'query,header', N'批次号', 1, N'送料暂收单·单头:草稿态可人工改(全链唯一可改点)'),
  (N'QC_RECV',     N'detail',       N'批次号', 0, N'送料暂收单·明细:随单头一致'),
  (N'QC_INSP',     N'query,header', N'批次号', 0, N'来料检验单·单头:随链继承,不可改'),
  (N'QC_INSP',     N'detail',       N'批次号', 0, N'来料检验单·明细:随单头一致'),
  (N'QC_RETURN',   N'query,header', N'批次号', 0, N'暂收退回单·单头:随链继承,不可改'),
  (N'QC_RETURN',   N'detail',       N'批次号', 0, N'暂收退回单·明细:随单头一致'),
  (N'PURCHASE_IN', N'query,header', N'批次号', 0, N'采购入库单·单头:随链继承,不可改'),
  (N'PURCHASE_IN', N'detail',       N'批次号', 0, N'采购入库单·明细:随单头一致'),
  (N'QC_TC_IN',    N'header',       N'批次号', 0, N'特采单·单头:随链继承,不可改');

UPDATE f SET f.editable = t.editable
FROM yj_field f JOIN @t t
  ON t.panel_code = f.panel_code AND t.place = f.place AND t.label = f.label
WHERE ISNULL(f.editable, 1) <> t.editable;

PRINT N'① 批次号字段可编辑口径已写入(暂收单头=1,其余=0)';
GO

/* ---------- ② 列中文注明改写为新口径 ---------- */
DECLARE @c TABLE (tbl sysname, col sysname, txt nvarchar(400));
INSERT INTO @c (tbl, col, txt) VALUES
  (N'sl_recv',          N'批次号', N'送料批次号:供应商编码去掉 YJ- 前缀 + - + 生单当天 yyyyMMdd(如 YJ-TX、2026-09-10 ⇒ TX-20260910);采购订单→送料暂收单生单时写入,下游检验/入库/退回逐站继承;仅本单草稿态单头可人工修改,审核后整链只读;明细行随单头一致'),
  (N'sl_recv_detail',   N'批次号', N'送料批次号(明细):随单头一致,由 BatchService.syncBatchNo 每次保存/审核按单头覆盖写入,不可手工修改'),
  (N'qc_insp',          N'批次号', N'送料批次号:随链从送料暂收单继承(生单时带入),不重新取号、不可修改;明细行随单头一致'),
  (N'qc_insp_detail',   N'批次号', N'送料批次号(明细):随单头一致,不可手工修改'),
  (N'bd_purchase_in',   N'批次号', N'送料批次号:随链从送料暂收单/来料检验单继承(生单时带入),不重新取号、不可修改;库存台账 kucun.lot_no 按它记批号'),
  (N'bl_purchase_in',   N'批次号', N'送料批次号(明细):随单头一致,不可手工修改'),
  (N'qc_return',        N'批次号', N'送料批次号:随链从来料检验单继承(退回单生单时带入),不重新取号、不可修改'),
  (N'qc_return_detail', N'批次号', N'送料批次号(明细):随单头一致,不可手工修改'),
  (N'qc_tc_in',         N'批次号', N'送料批次号:特采链随链继承(特采单审核生成入库单时带入),不可修改');

DECLARE @tbl sysname, @col sysname, @txt nvarchar(400);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT tbl, col, txt FROM @c;
OPEN cur; FETCH NEXT FROM cur INTO @tbl, @col, @txt;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF COL_LENGTH(N'dbo.' + @tbl, @col) IS NOT NULL
    BEGIN
        IF EXISTS (SELECT 1 FROM sys.extended_properties
                   WHERE major_id = OBJECT_ID(N'dbo.' + @tbl)
                     AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.' + @tbl), @col, 'ColumnId')
                     AND name = 'MS_Description')
            EXEC sp_updateextendedproperty N'MS_Description', @txt, N'SCHEMA', N'dbo', N'TABLE', @tbl, N'COLUMN', @col;
        ELSE
            EXEC sp_addextendedproperty N'MS_Description', @txt, N'SCHEMA', N'dbo', N'TABLE', @tbl, N'COLUMN', @col;
    END
    FETCH NEXT FROM cur INTO @tbl, @col, @txt;
END
CLOSE cur; DEALLOCATE cur;
PRINT N'② 批次号列中文注明已改写为「生单即定号」口径';
GO

/* 批次台账 batch_no 同批改写(原注明写的是"纯入库日期、审核时确认并回填全链") */
IF EXISTS (SELECT 1 FROM sys.extended_properties
           WHERE major_id = OBJECT_ID(N'dbo.yj_doc_batch')
             AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.yj_doc_batch'), 'batch_no', 'ColumnId')
             AND name = 'MS_Description')
    EXEC sp_updateextendedproperty N'MS_Description',
        N'送料批次号:供应商编码去掉 YJ- 前缀 + - + 生单当天 yyyyMMdd(如 YJ-TX、2026-09-10 ⇒ TX-20260910);采购订单→送料暂收单生单那一刻写入(status=ACTIVE),下游逐站继承不再取号;无序号,同一天同供应商共号;弃审/作废不回收',
        N'SCHEMA', N'dbo', N'TABLE', N'yj_doc_batch', N'COLUMN', N'batch_no';
ELSE
    EXEC sp_addextendedproperty N'MS_Description',
        N'送料批次号:供应商编码去掉 YJ- 前缀 + - + 生单当天 yyyyMMdd(如 YJ-TX、2026-09-10 ⇒ TX-20260910);采购订单→送料暂收单生单那一刻写入(status=ACTIVE),下游逐站继承不再取号;无序号,同一天同供应商共号;弃审/作废不回收',
        N'SCHEMA', N'dbo', N'TABLE', N'yj_doc_batch', N'COLUMN', N'batch_no';
PRINT N'②b yj_doc_batch.batch_no 中文注明已改写';
GO

/* ---------- ③ 自检 ---------- */
IF EXISTS (
    SELECT 1 FROM yj_field f
    WHERE f.label = N'批次号'
      AND f.panel_code IN (N'QC_INSP', N'QC_RETURN', N'PURCHASE_IN', N'QC_TC_IN')
      AND ISNULL(f.editable, 1) <> 0)
    RAISERROR(N'自检失败:检验/退回/入库/特采 仍有可编辑的批次号字段(应为全部 0)', 16, 1);

IF EXISTS (
    SELECT 1 FROM yj_field f
    WHERE f.label = N'批次号' AND f.panel_code = N'QC_RECV' AND f.place = N'detail'
      AND ISNULL(f.editable, 1) <> 0)
    RAISERROR(N'自检失败:送料暂收单明细批次号应为只读(随单头)', 16, 1);

IF NOT EXISTS (
    SELECT 1 FROM yj_field f
    WHERE f.label = N'批次号' AND f.panel_code = N'QC_RECV' AND f.place = N'query,header'
      AND f.editable = 1)
    RAISERROR(N'自检失败:送料暂收单单头批次号应为可编辑(草稿态唯一可改点)', 16, 1);

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
               WHERE major_id = OBJECT_ID(N'dbo.bd_purchase_in')
                 AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_purchase_in'), N'批次号', 'ColumnId')
                 AND name = 'MS_Description')
    RAISERROR(N'自检失败:bd_purchase_in.批次号 缺中文注明', 16, 1);

SELECT N'自检' AS k, f.panel_code, f.place, f.seq, f.label, f.editable
FROM yj_field f
WHERE f.label = N'批次号'
  AND f.panel_code IN (N'QC_RECV', N'QC_INSP', N'QC_RETURN', N'PURCHASE_IN', N'QC_TC_IN')
ORDER BY f.panel_code, f.place;
GO
PRINT N'✅ 批次号口径迁移完成:生单即定号(供应商编码 + 当天),仅送料暂收单草稿态单头可改,其余随链继承且只读';
GO
