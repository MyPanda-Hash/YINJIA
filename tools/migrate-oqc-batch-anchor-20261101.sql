/* migrate-oqc-batch-anchor-20261101.sql(2026-11-01 13:45):出厂检验报告 —— 锚到「生产工单批次」
 *
 * 用户口径(2026-11-01 13:45,针对「出货检验要按生产工单的批次号做检验、销售出库前发给客户」的方案):
 *   「只需要实现第一步即可，后面的不用自动生成和发送给客户这些都不用」
 *   ⇒ 本轮**只做第一步:数据模型**(把报告锚到生产工单批次),不做自动生成、不做发送客户/留痕。
 *
 * 第一步内容:
 *   ① qc_oqc_head 加 `工单号`(nvarchar 50) + `工单行号`(int) 两列 —— 报告从此能定位到
 *      「生产工单的哪一行(哪一批次)」;`批次号` 列早已存在。
 *      ⚠ 为什么不把「批次号」当唯一身份:`plang.批次号` 是完工日日期标签(实测 395 行只有 30 个值、
 *      27 个值跨多工单),唯一身份是 `(工单号, 工单行号)` ⇒ 锚这两列。
 *   ② 生成时写入:OqcReportService.createOne 在解析成品检验单时已拿到 工单号/工单行号,
 *      本轮把这两个值一并落库(此前只在内存里用来找首件/制程单)。
 *   ③ 历史报告回填:按 `qc_oqc_head.成品检验单号 → qc_asm_insp_head.工单号/工单行号` 回填
 *      (可空;回填不到的保持 NULL)。
 *   ④ 查询索引:(工单号, 工单行号) 普通索引,供列表/追溯查询。
 *      ⚠ **本轮不加唯一索引**:现在还是「出库行触发、一份=一个产品」的生成口径,同一生产批次
 *      从两行出库仍会各建一张;强加唯一键会让第二次生成直接抛 DB 唯一冲突。
 *      「一个生产批次一份报告、同批次多次出库复用」属于后续步骤(需要改生成逻辑),本轮不做。
 *   ⑤ yj_field 登记:工单号(query,header,可见)+ 工单行号(header,隐藏),en 译名。
 *
 * 规范:新增列写列级 MS_Description 中文注明;幂等(COL_LENGTH/OBJECT_ID/NOT EXISTS);
 *      两账套执行(先正式 HSDZ_MES、后测试 HSDZ_MES_TEST)。
 */

/* ============ A. qc_oqc_head 加「生产工单批次」锚列 ============ */
IF COL_LENGTH(N'dbo.qc_oqc_head', N'工单号') IS NULL
BEGIN
  ALTER TABLE dbo.qc_oqc_head ADD [工单号] nvarchar(50) NULL;
  PRINT N'[OK] qc_oqc_head +列 工单号';
END
ELSE PRINT N'[SKIP] qc_oqc_head 列已存在 工单号';

IF COL_LENGTH(N'dbo.qc_oqc_head', N'工单行号') IS NULL
BEGIN
  ALTER TABLE dbo.qc_oqc_head ADD [工单行号] int NULL;
  PRINT N'[OK] qc_oqc_head +列 工单行号';
END
ELSE PRINT N'[SKIP] qc_oqc_head 列已存在 工单行号';
GO

/* ============ B. 列中文注明 ============ */
DECLARE @cols TABLE (col sysname, note nvarchar(400));
INSERT INTO @cols (col, note) VALUES
 (N'工单号',   N'生产批次锚:本报告对应的生产工单号(取自成品检验单/工单行;与 工单行号 一起唯一确定一个生产批次)'),
 (N'工单行号', N'生产批次锚:生产工单的行号(plang.pl_xc;唯一身份 = 工单号+工单行号 —— 批次号只是完工日日期标签,会跨工单重复)');
DECLARE @c sysname, @n nvarchar(400);
DECLARE curc CURSOR LOCAL FAST_FORWARD FOR SELECT col, note FROM @cols;
OPEN curc FETCH NEXT FROM curc INTO @c, @n;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
                 WHERE major_id = OBJECT_ID(N'dbo.qc_oqc_head')
                   AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.qc_oqc_head'), @c, 'ColumnId')
                   AND name = N'MS_Description' AND class = 1)
    EXEC sp_addextendedproperty N'MS_Description', @n, N'SCHEMA', N'dbo', N'TABLE', N'qc_oqc_head', N'COLUMN', @c;
  FETCH NEXT FROM curc INTO @c, @n;
END
CLOSE curc DEALLOCATE curc;
GO

/* ============ C. 查询索引(普通索引;唯一/复用口径属后续步骤) ============ */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_qc_oqc_head_wo' AND object_id = OBJECT_ID(N'dbo.qc_oqc_head'))
BEGIN
  CREATE INDEX ix_qc_oqc_head_wo ON dbo.qc_oqc_head ([工单号], [工单行号]);
  PRINT N'[OK] qc_oqc_head 索引 ix_qc_oqc_head_wo 已建';
END
ELSE PRINT N'[SKIP] qc_oqc_head 索引已存在 ix_qc_oqc_head_wo';
GO

/* ============ D. 历史报告回填(成品检验单号 → 工单号/工单行号;回填不到保持 NULL) ============ */
UPDATE h
   SET h.[工单号] = a.[工单号],
       h.[工单行号] = a.[工单行号]
  FROM dbo.qc_oqc_head h
  JOIN dbo.qc_asm_insp_head a
    ON a.[单据编号] = h.[成品检验单号]
   AND ISNULL(a.asp_cancel, 'N') <> 'Y'
 WHERE h.[工单号] IS NULL
   AND ISNULL(a.[工单号], N'') <> N'';
PRINT N'[OK] 历史报告回填 工单号/工单行号(行数见下一条)';
GO

/* ============ E. yj_field 登记 + en 译名 ============ */
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_OQC_REPORT' AND col_name = N'工单号')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES (N'QC_OQC_REPORT', N'工单号', N'工单号', N'文本', N'query,header', 56, 140, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_OQC_REPORT' AND col_name = N'工单行号')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES (N'QC_OQC_REPORT', N'工单行号', N'工单行号', N'整数', N'header', 57, 80, 0, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'工单号' AND locale = N'en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'field', N'工单号', N'en', N'Work Order No.', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'工单行号' AND locale = N'en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'field', N'工单行号', N'en', N'Work Order Line No.', N'manual');
PRINT N'[OK] yj_field / yj_translation 就绪(工单号, 工单行号)';
GO

/* ============ F. 自检 ============ */
DECLARE @bad int = 0;
IF COL_LENGTH(N'dbo.qc_oqc_head', N'工单号') IS NULL SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.qc_oqc_head', N'工单行号') IS NULL SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_qc_oqc_head_wo' AND object_id = OBJECT_ID(N'dbo.qc_oqc_head')) SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_OQC_REPORT' AND col_name = N'工单号') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_OQC_REPORT' AND col_name = N'工单行号') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'工单号' AND locale = N'en') SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM sys.extended_properties
    WHERE major_id = OBJECT_ID(N'dbo.qc_oqc_head') AND name = N'MS_Description'
      AND minor_id IN (SELECT column_id FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.qc_oqc_head') AND name IN (N'工单号', N'工单行号'))) < 2 SET @bad = @bad + 1;
IF @bad > 0 RAISERROR(N'出厂检验报告「生产批次锚」迁移自检失败(缺列/缺索引/缺 yj_field/缺译名/缺注明)', 16, 1);
ELSE
BEGIN
  DECLARE @filled int = (SELECT COUNT(*) FROM dbo.qc_oqc_head WHERE [工单号] IS NOT NULL AND [工单号] <> N'');
  PRINT N'出厂检验报告生产批次锚就绪(qc_oqc_head.工单号/工单行号;历史回填 ' + CAST(@filled AS nvarchar(10)) + N' 张)';
END
GO
