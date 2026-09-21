/* ============================================================================
 * 采购链「送料批次号」取号时机迁移:分批送料生成时 → **采购入库单审核时**
 * ----------------------------------------------------------------------------
 * 用户定稿口径(2026-09-21,不可再改口径):
 *   ① 格式 = yyyyMMdd + 两位序号,**无分隔符**(如 2026092101 = 2026-09-21 第 1 批);
 *   ② 日期部分取**送料当天**(暂收单/台账行创建那天),**不是**审核当天;
 *   ③ 唯一性范围 = **采购订单号 + 批次号**(不同采购订单之间允许重号,不是全局唯一);
 *   ④ 取号 = 同订单 + 同送料日「已用最大序号 + 1」;**弃审/作废不回收批次号**
 *      (因此会跳号,但绝不重号);
 *   ⑤ 入库审核之前链路上所有单据批次号**留空**;审核时取号并回填
 *      送料暂收单(头+行)/来料检验单(头+行)/采购入库单(头+行)/批次台账/链路台账;
 *   ⑥ 历史批次号(YJ-20260916-03-001 那种)原样不动 —— 新规则只对新单生效。
 *
 * 本脚本(幂等):
 *   ① yj_doc_batch.batch_no 改**可空**(取号前为 NULL,承载"已送未编号"的批次);
 *      删旧筛选唯一索引 UX_yj_doc_batch_active(唯一键 source_panel_code+source_form_no+batch_seq
 *      —— 旧口径序号可回收,新口径不回收,该唯一键已无意义);
 *      新建**复合**筛选唯一索引 UX_yj_doc_batch_no_active:唯一键 (source_form_no, batch_no),
 *      条件 WHERE status='ACTIVE' AND batch_no IS NOT NULL
 *      —— 重号只允许**跨采购订单**(需求③),同订单同日绝不重号;
 *         PENDING(未编号, batch_no IS NULL)行不参与唯一性,同订单可并存多批待编号;
 *   ② 新增**批次键**链路列:sl_recv / qc_insp / bd_purchase_in 各一列 [批次键] int NULL,
 *      承载 yj_doc_batch.id —— 审核时**顺着键**回填(不按单号字符串匹配:单号复用/改号会回填错单);
 *      form_flow_link 加 batch_id int NULL(同义,沿用英文列风格);
 *   ③ yj_field 为三面板(QC_RECV / QC_INSP / PURCHASE_IN)各注册**隐藏**字段「批次键」
 *      (place=header, seq=900, hidden=1, visible=0, editable=0, required=0):
 *      通用保存的「标签→列」映射据此把链路键逐站带下去(一单一单,挂单头即够,行上另余批次号);
 *   ④ 新增/改动列全部写 MS_Description 中文注明;字段补 en 译名(多语言强制规范);
 *   ⑤ 自检:索引已改、三表列在、三面板隐藏字段在。
 *
 * 配套代码(同提交):
 *   · BatchService.assignNoAndBackfill / findPendingBatchId;releaseByTarget 改为**不回收**;
 *   · PushGenerateHandler.generateBatch:不再取号,插 status='PENDING'/batch_no=NULL 台账行
 *     (create_time=送料当天),把该行 id 写进目标单头「批次键」,批次号留空;
 *   · ButtonService:采购入库单审核/审批通过钩子取号回填;检验→入库自动生单带「批次键」;
 *     作废/删单路径不回收台账号;
 *   · PanelConfigService:头同义词补 {批次键 → 批次键}(缓转头映射 7 条上限截断)。
 * ========================================================================== */

SET NOCOUNT ON;
GO

/* 筛选索引(CREATE INDEX ... WHERE)要求这些 SET 选项:sqlcmd 默认 QUOTED_IDENTIFIER OFF,
   不显式置位会报「CREATE INDEX 失败,因为下列 SET 选项的设置不正确: 'QUOTED_IDENTIFIER'」。
   JDBC(SqlRunner)默认已是 ON,此处显式置位使两条执行通道口径一致。 */
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET NUMERIC_ROUNDABORT OFF;
GO

/* ---------- ① yj_doc_batch:batch_no 可空 + 筛选唯一索引改复合 ---------- */
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.yj_doc_batch')
           AND name = 'batch_no' AND is_nullable = 0)
    ALTER TABLE dbo.yj_doc_batch ALTER COLUMN batch_no nvarchar(100) NULL;
PRINT N'yj_doc_batch.batch_no 可空已就位';
GO

IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_yj_doc_batch_active' AND object_id = OBJECT_ID('dbo.yj_doc_batch'))
    DROP INDEX UX_yj_doc_batch_active ON dbo.yj_doc_batch;
PRINT N'旧筛选唯一索引 UX_yj_doc_batch_active 已删(旧口径:序号可回收)';
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_yj_doc_batch_no_active' AND object_id = OBJECT_ID('dbo.yj_doc_batch'))
   AND NOT EXISTS (SELECT 1 FROM yj_doc_batch WHERE status = 'ACTIVE' AND batch_no IS NOT NULL
                   GROUP BY source_form_no, batch_no HAVING COUNT(*) > 1)
    CREATE UNIQUE INDEX UX_yj_doc_batch_no_active ON dbo.yj_doc_batch (source_form_no, batch_no)
        WHERE status = 'ACTIVE' AND batch_no IS NOT NULL;
PRINT N'复合筛选唯一索引 UX_yj_doc_batch_no_active 已建(唯一键 = 采购订单号 + 批次号)';
GO

/* ---------- ② 批次键链路列(台账行 id;审核时顺着键回填) ---------- */
IF COL_LENGTH('dbo.sl_recv', N'批次键') IS NULL ALTER TABLE dbo.sl_recv ADD [批次键] int NULL;
IF COL_LENGTH('dbo.qc_insp', N'批次键') IS NULL ALTER TABLE dbo.qc_insp ADD [批次键] int NULL;
IF COL_LENGTH('dbo.bd_purchase_in', N'批次键') IS NULL ALTER TABLE dbo.bd_purchase_in ADD [批次键] int NULL;
IF COL_LENGTH('dbo.form_flow_link', N'batch_id') IS NULL ALTER TABLE dbo.form_flow_link ADD [batch_id] int NULL;
GO

/* ---------- ③ yj_field:三面板各注册隐藏字段「批次键」 ---------- */
DECLARE @bk TABLE (panel VARCHAR(20), seq INT);
INSERT INTO @bk VALUES ('QC_RECV', 900), ('QC_INSP', 900), ('PURCHASE_IN', 900);
INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
SELECT b.panel, N'批次键', N'批次键', N'整数', N'header', b.seq, 80, 0, 0, 1, 0
FROM @bk b
WHERE NOT EXISTS (SELECT 1 FROM yj_field x WHERE x.panel_code = b.panel AND x.col_name = N'批次键');
PRINT N'隐藏字段「批次键」已注册: ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
GO

/* 字段译名(多语言强制规范;隐藏字段不显示,登记 en 即可) */
MERGE yj_translation AS t USING (VALUES (N'批次键', N'en', N'Batch key')) AS s(ref_key, locale, text)
ON t.scope = 'field' AND t.ref_key = s.ref_key AND t.locale = s.locale
WHEN NOT MATCHED THEN INSERT (scope, ref_key, locale, text, source) VALUES ('field', s.ref_key, s.locale, s.text, 'manual');
GO

/* ---------- ④ 新增/改动列中文注明 ---------- */
DECLARE @cm TABLE (tbl SYSNAME, col SYSNAME, txt NVARCHAR(400));
INSERT INTO @cm VALUES
 ('sl_recv',        N'批次键', N'批次键:批次台账 yj_doc_batch.id;采购入库单审核时顺键回填本单批次号,取号前为空'),
 ('qc_insp',        N'批次键', N'批次键:批次台账 yj_doc_batch.id;由送料暂收单逐站带下,采购入库单审核时顺键回填批次号'),
 ('bd_purchase_in', N'批次键', N'批次键:批次台账 yj_doc_batch.id;采购入库单审核时凭它取号并回填全链批次号'),
 ('form_flow_link', N'batch_id', N'批次键:批次台账 yj_doc_batch.id;该跳占用所属批次(与 batch_no 同源,取号时一并回填)'),
 ('yj_doc_batch',   N'batch_no', N'送料批次号:yyyyMMdd+两位序号(如 2026092101 = 2026-09-21 第 1 批);日期取送料当天,采购入库单审核时取号并回填,弃审/作废不回收;历史 YJ- 格式号原样保留');
DECLARE @t SYSNAME, @c SYSNAME, @x NVARCHAR(400);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT tbl, col, txt FROM @cm;
OPEN cur; FETCH NEXT FROM cur INTO @t, @c, @x;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF COL_LENGTH('dbo.' + @t, @c) IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM sys.extended_properties
                     WHERE major_id = OBJECT_ID('dbo.' + @t)
                       AND minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.' + @t), @c, 'ColumnId')
                       AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', @x, N'SCHEMA', N'dbo', N'TABLE', @t, N'COLUMN', @c;
  FETCH NEXT FROM cur INTO @t, @c, @x;
END
CLOSE cur; DEALLOCATE cur;
PRINT N'列中文注明已补';
GO

/* ---------- ⑤ 自检 ---------- */
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_yj_doc_batch_active' AND object_id = OBJECT_ID('dbo.yj_doc_batch'))
    RAISERROR(N'旧的筛选唯一索引 UX_yj_doc_batch_active 仍在', 16, 1);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_yj_doc_batch_no_active' AND object_id = OBJECT_ID('dbo.yj_doc_batch'))
    RAISERROR(N'复合筛选唯一索引 UX_yj_doc_batch_no_active 未建', 16, 1);
IF (SELECT is_nullable FROM sys.columns WHERE object_id = OBJECT_ID('dbo.yj_doc_batch') AND name = 'batch_no') = 0
    RAISERROR(N'yj_doc_batch.batch_no 仍为 NOT NULL', 16, 1);
IF COL_LENGTH('dbo.sl_recv', N'批次键') IS NULL OR COL_LENGTH('dbo.qc_insp', N'批次键') IS NULL
   OR COL_LENGTH('dbo.bd_purchase_in', N'批次键') IS NULL OR COL_LENGTH('dbo.form_flow_link', N'batch_id') IS NULL
    RAISERROR(N'批次键链路列缺失', 16, 1);
IF (SELECT COUNT(*) FROM yj_field WHERE col_name = N'批次键'
    AND panel_code IN ('QC_RECV', 'QC_INSP', 'PURCHASE_IN')
    AND place LIKE '%header%' AND hidden = 1 AND visible = 0 AND editable = 0 AND required = 0) <> 3
    RAISERROR(N'三面板隐藏字段「批次键」未注册齐', 16, 1);
PRINT N'✅ 批次号取号时机迁移完成:可空 + 复合唯一(订单+批次号) + 批次键链路列 + 三面板隐藏字段';
GO
