/* ============================================================================
   migrate-sample-ext-detail-20261106.sql
   外部开发样品申请单 —— **总表 + 子表**（一单多样品）

   【需求来源·用户原话（2026-11-06）】
     「总表+子表：模板 row12 写「一张样品单可加多个样品」，现在仍是一单一 样品（8 列即该样品）。
       要做成子表得改数据模型（rd_sample_ext_detail 补 8 列 + place='detail' + 纸面多行 + 行级校验）」

   设计文件 sheet1 row12-13 原文：
     · 实现方式：总表+子表的模式（单个样品单下面可以添加多个样品）
     · 总表列表展示字段：下单日期、样品单编号、申请人、审核人、确认人、费用

   【本脚本做什么】
     1) rd_sample_ext_detail 补 8 个样品属性列（与表头同名的同类型列，nvarchar 长度对齐表头）；
     2) 这 8 个字段在 yj_field 里从 place='header' 挪到 place='detail'（seq 10..80 = 模板列序），
        纸面从此按「一行一个样品」渲染，行级必填由引擎的明细校验负责
        （PanelxList.validateInlineDraft：空行跳过、非空行逐格校验）；
     3) 存量单据迁移：表头里已填过样品属性的老单，搬成**一条明细行**（幂等：该单已有明细行则不搬）；
     4) 表/列注明 + 自检。

   【为什么保留表头那 8 列不删】
     已上线单据的旧值还在表头列里（迁移只做「搬一份到明细」，不抹表头）：
     表头字段已不在 place='header' 里 ⇒ 保存时不会再写它们，也不会被纸面回显；
     留着只为可回溯，删列属不可逆操作，不在本次范围。

   ⚠ 幂等：ADD COLUMN 用 COL_LENGTH、字段迁移用 place 条件、存量搬迁用 NOT EXISTS。
   ⚠ 两账套纪律：正式库 HSDZ_MES 与测试库 HSDZ_MES_TEST 各跑一遍（本机只有前者）。
   ============================================================================ */

SET NOCOUNT ON;
SET XACT_ABORT ON;
BEGIN TRAN;

/* ══════════════════════════════════════════════════════════════════════
   1) 明细表补 8 列（模板 row3-6 的 8 个样品属性）
   ══════════════════════════════════════════════════════════════════════ */
IF COL_LENGTH('rd_sample_ext_detail', N'产品整体规格') IS NULL
    ALTER TABLE rd_sample_ext_detail ADD [产品整体规格] nvarchar(500) NULL;
IF COL_LENGTH('rd_sample_ext_detail', N'炭棒规格') IS NULL
    ALTER TABLE rd_sample_ext_detail ADD [炭棒规格] nvarchar(500) NULL;
IF COL_LENGTH('rd_sample_ext_detail', N'样品数量') IS NULL
    ALTER TABLE rd_sample_ext_detail ADD [样品数量] nvarchar(50) NULL;
IF COL_LENGTH('rd_sample_ext_detail', N'组装要求') IS NULL
    ALTER TABLE rd_sample_ext_detail ADD [组装要求] nvarchar(500) NULL;
IF COL_LENGTH('rd_sample_ext_detail', N'产品功能') IS NULL
    ALTER TABLE rd_sample_ext_detail ADD [产品功能] nvarchar(200) NULL;
IF COL_LENGTH('rd_sample_ext_detail', N'背景') IS NULL
    ALTER TABLE rd_sample_ext_detail ADD [背景] nvarchar(500) NULL;
IF COL_LENGTH('rd_sample_ext_detail', N'性能要求') IS NULL
    ALTER TABLE rd_sample_ext_detail ADD [性能要求] nvarchar(500) NULL;
IF COL_LENGTH('rd_sample_ext_detail', N'配方及工艺要求') IS NULL
    ALTER TABLE rd_sample_ext_detail ADD [配方及工艺要求] nvarchar(500) NULL;
GO

/* 表注明（规范：新增/变更表结构必须带中文注明） */
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
                WHERE major_id = OBJECT_ID('rd_sample_ext_detail') AND minor_id = 0 AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description',
        N'（外部）开发样品申请单-明细（总表+子表：一张申请单下可加多个样品，一行一个样品）',
        'SCHEMA','dbo','TABLE','rd_sample_ext_detail';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
                WHERE major_id = OBJECT_ID('rd_sample_ext_detail')
                  AND minor_id = COLUMNPROPERTY(OBJECT_ID('rd_sample_ext_detail'), N'产品整体规格', 'ColumnId')
                  AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description',
        N'产品整体规格：组装后炭棒总长度或其他明确的尺寸要求（模板 row3-4 A:B 列）',
        'SCHEMA','dbo','TABLE','rd_sample_ext_detail','COLUMN',N'产品整体规格';
GO

/* ══════════════════════════════════════════════════════════════════════
   2) yj_field：8 个字段 place header → detail（seq 10..80，按模板列序）
   ══════════════════════════════════════════════════════════════════════ */
UPDATE f
   SET f.place = 'detail', f.seq = v.seq
  FROM yj_field f
  JOIN (VALUES
        (N'产品整体规格', 10), (N'炭棒规格', 20), (N'样品数量', 30), (N'组装要求', 40),
        (N'产品功能', 50), (N'背景', 60), (N'性能要求', 70), (N'配方及工艺要求', 80)
       ) AS v(label, seq) ON v.label = f.label
 WHERE f.panel_code = 'RD_SAMPLE_EXT';
GO

/* ══════════════════════════════════════════════════════════════════════
   3) 存量单据：表头里已填的样品属性 → 一条明细行（幂等）
   ══════════════════════════════════════════════════════════════════════ */
INSERT INTO rd_sample_ext_detail
       ([单据编号],[产品整体规格],[炭棒规格],[样品数量],[组装要求],[产品功能],[背景],[性能要求],[配方及工艺要求],
        asp_user1, asp_time1, asp_cancel)
SELECT h.[单据编号], h.[产品整体规格], h.[炭棒规格], h.[样品数量], h.[组装要求], h.[产品功能], h.[背景], h.[性能要求], h.[配方及工艺要求],
       h.asp_user1, GETDATE(), 'N'
  FROM rd_sample_ext_head h
 WHERE ISNULL(h.asp_cancel,'N') <> 'Y'
   AND (ISNULL(h.[产品整体规格],'') <> '' OR ISNULL(h.[炭棒规格],'') <> '' OR ISNULL(h.[样品数量],'') <> ''
     OR ISNULL(h.[组装要求],'') <> '' OR ISNULL(h.[产品功能],'') <> '' OR ISNULL(h.[背景],'') <> ''
     OR ISNULL(h.[性能要求],'') <> '' OR ISNULL(h.[配方及工艺要求],'') <> '')
   AND NOT EXISTS (SELECT 1 FROM rd_sample_ext_detail d
                    WHERE d.[单据编号] = h.[单据编号] AND ISNULL(d.asp_cancel,'N') <> 'Y');
GO

/* ══════════════════════════════════════════════════════════════════════
   4) 自检
   ══════════════════════════════════════════════════════════════════════ */
IF (SELECT COUNT(*) FROM sys.columns
     WHERE object_id = OBJECT_ID('rd_sample_ext_detail')
       AND name IN (N'产品整体规格',N'炭棒规格',N'样品数量',N'组装要求',N'产品功能',N'背景',N'性能要求',N'配方及工艺要求')) < 8
    RAISERROR(N'migrate-sample-ext-detail: 自检失败 —— 明细表业务列不足 8 个', 16, 1);

IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = 'RD_SAMPLE_EXT' AND place = 'detail') < 8
    RAISERROR(N'migrate-sample-ext-detail: 自检失败 —— yj_field 明细字段不足 8 个', 16, 1);
GO

COMMIT TRAN;
GO
