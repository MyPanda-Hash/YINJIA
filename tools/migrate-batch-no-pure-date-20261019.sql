/* ============================================================================
 * migrate-batch-no-pure-date-20261019.sql —— 采购链「送料批次号」口径改回**纯日期 yyyyMMdd**
 * ----------------------------------------------------------------------------
 * 用户口径(2026-10-19《10.19 问题》第 1 条):
 *   「批次号改回采用日期的方式,不再是'供应商+日期'。就是 WR- 后面的数据,需要引号里面的日期数据。」
 *   截图里材料码弹窗的批次号是 `WR-20261019`(供应商编码 YJ-WR 去前缀 + 日期),用户要的是**日期那一段**
 *   ⇒ 批次号 = `20261019`(纯日期,8 位)。
 *
 * 变更前的口径(2026-10-04,本次作废但**不改历史数据**):
 *   批次号 = 供应商编码去掉 `YJ-` 前缀 + `-` + 生单当天 yyyyMMdd(如 YJ-XH ⇒ XH-20261019)。
 *
 * 本脚本(幂等,纯注释改动,不动一行业务数据):
 *   ① 把链路四单 + 材料码打印单里「批次号」列、以及批次台账 `yj_doc_batch.batch_no` 的
 *      MS_Description 改写成新口径(历史库里已有的 XH-20261019 这类旧号**原样保留**,
 *      新号只对本次之后生成/打印的单生效);
 *   ② 自检:六处列注明都包含「纯日期」字样,否则 RAISERROR(缺列的面板跳过,不报错)。
 *
 * ⚠ 同一批代码改动(同提交):BatchService.buildBatchNo(LocalDate) 返回纯日期、
 *   PushGenerateHandler / PuLabelService / ButtonService.syncBatchNo 三处取号、
 *   前端 BatchSendDialog / MaterialLabelDialog 的占位词与 10 个语言包的词条
 *   (tools/archive/_i18n-batch-no-20261019.cjs)。
 * ========================================================================== */

SET NOCOUNT ON;
GO

/* ---------- ① 列中文注明改写(列不存在则跳过:历史血统/未建面板不报错) ---------- */
DECLARE @cols TABLE (tbl sysname, col sysname, txt nvarchar(600));
INSERT INTO @cols (tbl, col, txt) VALUES
 (N'sl_recv', N'批次号',
  N'送料批次号:**纯日期 yyyyMMdd**(如 20261019;2026-10-19 用户口径「改回采用日期的方式,不再是供应商+日期」)。采购订单→送料暂收单生单那一刻写入,下游检验/入库/退回逐站继承;同一天所有批次共号(不唯一、不带序号);仅本单草稿态单头可人工改,审核后整链只读;明细行随单头一致。历史号(如 XH-20261019 / YJ-…)原样保留'),
 (N'qc_insp', N'批次号',
  N'送料批次号:**纯日期 yyyyMMdd**(如 20261019;2026-10-19 口径,不再拼供应商编码),由暂收单生单时定稿并逐站继承;明细行随单头一致,只读'),
 (N'qc_return', N'批次号',
  N'送料批次号:**纯日期 yyyyMMdd**(如 20261019;2026-10-19 口径,不再拼供应商编码),随链继承;历史号原样保留'),
 (N'bd_purchase_in', N'批次号',
  N'送料批次号:**纯日期 yyyyMMdd**(如 20261019;2026-10-19 口径,不再拼供应商编码),随链继承;历史号原样保留'),
 (N'bd_pu_label', N'批次号',
  N'★本批材料码上的批次号:默认=**纯日期 yyyyMMdd**(如 20261019;2026-10-19 口径,不再拼供应商编码),可人工改;打印后即为该订单上批次号的权威值,生单按它落库、不再按公式重算'),
 (N'yj_doc_batch', N'batch_no',
  N'送料批次号:**纯日期 yyyyMMdd**(如 20261019;2026-10-19 用户口径)。采购订单→送料暂收单生单那一刻写入(status=ACTIVE),下游逐站继承不再取号;同一天共号,不唯一;弃审/作废不回收;历史 YJ-/10 位/XH-yyyyMMdd 旧号原样保留');

DECLARE @t sysname, @c sysname, @x nvarchar(600);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT tbl, col, txt FROM @cols;
OPEN cur;
FETCH NEXT FROM cur INTO @t, @c, @x;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF COL_LENGTH(N'dbo.' + @t, @c) IS NOT NULL
    BEGIN
        IF EXISTS (SELECT 1 FROM sys.extended_properties ep
                   WHERE ep.major_id = OBJECT_ID(N'dbo.' + @t)
                     AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.' + @t), @c, 'ColumnId')
                     AND ep.name = N'MS_Description')
            EXEC sp_updateextendedproperty N'MS_Description', @x,
                 N'SCHEMA', N'dbo', N'TABLE', @t, N'COLUMN', @c;
        ELSE
            EXEC sp_addextendedproperty N'MS_Description', @x,
                 N'SCHEMA', N'dbo', N'TABLE', @t, N'COLUMN', @c;
        PRINT N'[注明] ' + @t + N'.' + @c + N' → 纯日期口径';
    END
    ELSE
        PRINT N'[跳过] ' + @t + N'.' + @c + N' 不存在该列';
    FETCH NEXT FROM cur INTO @t, @c, @x;
END
CLOSE cur; DEALLOCATE cur;
GO

/* ---------- ② 自检:每个存在的批次号列都必须写明「纯日期」 ---------- */
DECLARE @bad int = 0;
SELECT @bad = COUNT(*) FROM (
    SELECT N'sl_recv' t, N'批次号' c UNION ALL
    SELECT N'qc_insp', N'批次号' UNION ALL
    SELECT N'qc_return', N'批次号' UNION ALL
    SELECT N'bd_purchase_in', N'批次号' UNION ALL
    SELECT N'bd_pu_label', N'批次号' UNION ALL
    SELECT N'yj_doc_batch', N'batch_no') x
WHERE COL_LENGTH(N'dbo.' + x.t, x.c) IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
                  WHERE ep.major_id = OBJECT_ID(N'dbo.' + x.t)
                    AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.' + x.t), x.c, 'ColumnId')
                    AND ep.name = N'MS_Description'
                    AND CONVERT(nvarchar(600), ep.value) LIKE N'%纯日期%');
IF @bad > 0
    RAISERROR(N'批次号列注明未全部改写为「纯日期」口径(共 %d 列未命中)', 16, 1, @bad);
ELSE
    PRINT N'✅ 批次号口径迁移完成:6 处列(存在的)均已注明为纯日期 yyyyMMdd';
GO
