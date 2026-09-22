/* ============================================================================
 * 采购链「送料批次号」口径再变更:yyyyMMdd + 两位序号 → **纯入库日期**,且可人工修改
 * ----------------------------------------------------------------------------
 * 用户定稿口径(2026-09-21 二次变更,**以本条为准**;前一条 migrate-batch-no-at-inbound.sql
 * 的格式/唯一性部分被本条覆盖):
 *   ① 格式 = **纯日期 yyyyMMdd**(如 20260921),**不再带两位序号**;
 *   ② 「同一日期算同一批次」:同一天的多批共用同一个批次号(允许重复);
 *   ③ 日期取**采购入库单的「单据日期」**(不是送料当天、也不是审核当天);
 *   ④ 预设 + 人工修改:入库单填单/生单时**预设**该号(前端 docDefaults),
 *      用户**可人工改**;审核时以表头「批次号」为准(人工改过的优先);
 *   ⑤ 回填时机不变:采购入库单**审核**时把最终号回填全链
 *      (暂收/检验/入库 头+行、批次台账、form_flow_link);
 *   ⑥ 历史批次号(YJ-… / 2026092101 等)原样保留,只对新单生效。
 *
 * 本脚本(幂等):
 *   ① 删筛选唯一索引 UX_yj_doc_batch_no_active —— 唯一键 = (采购订单号, 批次号);
 *      新口径「同一天共号」下,同订单当天的第二張入库单会被它直接拒掉(违反口径 ②),
 *      故唯一性整体取消;
 *   ② 建**非唯一**筛选索引 IX_yj_doc_batch_no_active (batch_no, source_form_no)
 *      WHERE status='ACTIVE' AND batch_no IS NOT NULL —— 保留"按批次号反查""按订单+号查"的性能,
 *      不再有唯一约束;
 *   ③ 改写 yj_doc_batch.batch_no 的 MS_Description(旧注明写的是"两位序号"口径);
 *   ④ 自检(旧唯一索引已删 / 新非唯一索引在位且 is_unique=0)。
 *
 * ⚠ 筛选索引(CREATE INDEX ... WHERE)要求 SET QUOTED_IDENTIFIER ON:sqlcmd 默认 OFF 会报 1934,
 *   故脚本头部显式置位(JDBC/SqlRunner 默认已 ON)。
 *
 * 配套代码(同提交):
 *   · BatchService.assignNoAndBackfill:不再计算序号 —— 取入库单表头「批次号」(人工优先),
 *     空则按该单「单据日期」的 yyyyMMdd 补;回填范围不变;
 *   · 前端 core/panel/docDefaults.js:采购入库单新建/打开时预设 批次号 = 单据日期(yyyyMMdd),
 *     且「单据日期」改动而批次号仍是上一次自动值时跟随变化(人工改过则不动);
 *   · 前端 core/views/BatchSendDialog.vue:修复"只勾选一行却全部生单"(勾选成为权威)。
 * ========================================================================== */

SET NOCOUNT ON;
GO

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET NUMERIC_ROUNDABORT OFF;
GO

/* ---------- ① 取消 (采购订单号, 批次号) 的筛选唯一性 ---------- */
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_yj_doc_batch_no_active' AND object_id = OBJECT_ID('dbo.yj_doc_batch'))
    DROP INDEX UX_yj_doc_batch_no_active ON dbo.yj_doc_batch;
PRINT N'筛选唯一索引 UX_yj_doc_batch_no_active 已删(新口径:同一天共号,不再唯一)';
GO

/* ---------- ② 建非唯一筛选索引(保留反查性能) ---------- */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_yj_doc_batch_no_active' AND object_id = OBJECT_ID('dbo.yj_doc_batch'))
    CREATE NONCLUSTERED INDEX IX_yj_doc_batch_no_active ON dbo.yj_doc_batch (batch_no, source_form_no)
        WHERE status = 'ACTIVE' AND batch_no IS NOT NULL;
PRINT N'非唯一筛选索引 IX_yj_doc_batch_no_active 已建(batch_no, source_form_no)';
GO

/* ---------- ③ 列中文注明改写为新口径 ---------- */
IF EXISTS (SELECT 1 FROM sys.extended_properties
           WHERE major_id = OBJECT_ID('dbo.yj_doc_batch')
             AND minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.yj_doc_batch'), 'batch_no', 'ColumnId')
             AND name = 'MS_Description')
    EXEC sp_updateextendedproperty N'MS_Description',
        N'送料批次号:纯入库日期 yyyyMMdd(如 20260921);同一日期算同一批次(同一天多批同号,不唯一);日期取采购入库单「单据日期」,填单时预设、可人工修改,审核时以表头值为准并回填全链;历史 YJ-/10位号原样保留',
        N'SCHEMA', N'dbo', N'TABLE', N'yj_doc_batch', N'COLUMN', N'batch_no';
ELSE
    EXEC sp_addextendedproperty N'MS_Description',
        N'送料批次号:纯入库日期 yyyyMMdd(如 20260921);同一日期算同一批次(同一天多批同号,不唯一);日期取采购入库单「单据日期」,填单时预设、可人工修改,审核时以表头值为准并回填全链;历史 YJ-/10位号原样保留',
        N'SCHEMA', N'dbo', N'TABLE', N'yj_doc_batch', N'COLUMN', N'batch_no';
PRINT N'yj_doc_batch.batch_no 中文注明已改写为新口径';
GO

/* ---------- ④ 自检 ---------- */
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_yj_doc_batch_no_active' AND object_id = OBJECT_ID('dbo.yj_doc_batch'))
    RAISERROR(N'筛选唯一索引 UX_yj_doc_batch_no_active 仍在:同一天共号会被拒', 16, 1);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_yj_doc_batch_no_active' AND object_id = OBJECT_ID('dbo.yj_doc_batch'))
    RAISERROR(N'非唯一筛选索引 IX_yj_doc_batch_no_active 未建', 16, 1);
IF (SELECT is_unique FROM sys.indexes WHERE name = 'IX_yj_doc_batch_no_active' AND object_id = OBJECT_ID('dbo.yj_doc_batch')) = 1
    RAISERROR(N'IX_yj_doc_batch_no_active 仍是唯一索引', 16, 1);
PRINT N'✅ 批次号口径迁移完成:纯日期 + 同一天共号(唯一性取消,改非唯一筛选索引)';
GO
