/*
 * migrate-rd-change-approval-sign-20261111.sql
 *
 * 目的：产品变更申请表（RD_CHANGE）纸面「批准 / 签字 / 日期」三格**由审批动作回填**。
 *
 * 用户口径（2026-11-11）：
 *   「选择会签人之后，提交审批，审批的时候弹出弹窗，审批人可以进行批准，还有签字，
 *    把信息回填进这里面，还有日期，…保存之后该单据可见内容，打印出来也是有数据的」
 *
 * 落点：rd_change_head 的备用列池（变更类型已占 备用1）——
 *   批准人   → 备用2   （审批通过的人，姓名）
 *   批准签字 → 备用3   （弹窗里填的签字，默认=审批人姓名）
 *   批准日期 → 备用4   （弹窗里选的日期，默认=当天）
 *
 * ⚠ 为什么用备用列而不是加物理列：
 *   仓库既有「动态字段(备用列池)」机制（docs/design/动态字段扩展-备用列池-V1.0.md）就是干这个的，
 *   插 yj_field 行即可零 DDL 生效，且引擎（查询/保存/导出/打印）按 label 一视同仁。
 *   走新物理列反而要动表结构 + 进迁移链两条账套。
 *
 * ⚠ editable=0：这三格是**审批动作的产物**，不是人手填的 —— 纸面只读，
 *   真源只有「审批通过」这一条路径（ButtonService 的 RD_CHANGE 分支）。
 *   与质量单据「编制/审核/批准」三格同款口径（见 ButtonService writeBackSignCell 注释）。
 *
 * 幂等：全部带 NOT EXISTS / COL_LENGTH 守卫，重复执行无副作用。
 * 执行：两个账套都要跑（HSDZ_MES / HSDZ_MES_TEST）。
 */

SET NOCOUNT ON;
SET XACT_ABORT ON;

/* ── ① 备用列必须存在（rd_change_head 的备用列池由 migrate-spare-columns.sql 预置）── */
IF COL_LENGTH('rd_change_head', '备用2') IS NULL
   OR COL_LENGTH('rd_change_head', '备用3') IS NULL
   OR COL_LENGTH('rd_change_head', '备用4') IS NULL
BEGIN
    RAISERROR(N'[rd-change-sign] rd_change_head 缺 备用2/3/4 列，请先跑备用列池迁移', 16, 1);
    RETURN;
END

/* ── ② 登记三个字段（label = 纸面标签，col_name = 备用列）──────────────────── */
DECLARE @fields TABLE (label nvarchar(60) PRIMARY KEY, col nvarchar(20), seq int, en nvarchar(60));
INSERT INTO @fields (label, col, seq, en) VALUES
    (N'批准人',   N'备用2', 300, N'Approved by'),
    (N'批准签字', N'备用3', 310, N'Approval signature'),
    (N'批准日期', N'备用4', 320, N'Approval date');

INSERT INTO yj_field (panel_code, col_name, label, label_en, data_type, place, seq, editable, required, hidden, visible)
SELECT N'RD_CHANGE', f.col, f.label, f.en, N'文本', N'header', f.seq, 0, 0, 0, 1
FROM @fields f
WHERE NOT EXISTS (SELECT 1 FROM yj_field x WHERE x.panel_code = N'RD_CHANGE' AND x.label = f.label);
PRINT '[rd-change-sign] yj_field inserted = ' + CAST(@@ROWCOUNT AS nvarchar(10));

/* 已存在但被改成可编辑的，拉回只读（防人工把它变回可填） */
UPDATE yj_field SET editable = 0
WHERE panel_code = N'RD_CHANGE' AND label IN (N'批准人', N'批准签字', N'批准日期') AND ISNULL(editable, 1) <> 0;
PRINT '[rd-change-sign] editable forced to 0 = ' + CAST(@@ROWCOUNT AS nvarchar(10));

/* ── ③ 多语言（AGENTS 强制规范：至少 en）────────────────────────────────── */
INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT N'field', f.label, N'en', f.en, N'manual'
FROM @fields f
WHERE NOT EXISTS (SELECT 1 FROM yj_translation t
                  WHERE t.scope = N'field' AND t.ref_key = f.label AND t.locale = N'en');
PRINT '[rd-change-sign] translations inserted = ' + CAST(@@ROWCOUNT AS nvarchar(10));

/* ── ④ 列注明（数据库规范：动过的列要能说清用途）───────────────────────── */
DECLARE @tbl sysname = N'rd_change_head', @col sysname, @desc nvarchar(200);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT col, label + N'(审批通过时回填，纸面只读)' FROM @fields;
OPEN cur;
FETCH NEXT FROM cur INTO @col, @desc;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
                   WHERE major_id = OBJECT_ID(@tbl) AND minor_id = COLUMNPROPERTY(OBJECT_ID(@tbl), @col, 'ColumnId')
                     AND name = 'MS_Description')
        EXEC sp_addextendedproperty N'MS_Description', @desc, N'SCHEMA', N'dbo', N'TABLE', @tbl, N'COLUMN', @col;
    ELSE
        EXEC sp_updateextendedproperty N'MS_Description', @desc, N'SCHEMA', N'dbo', N'TABLE', @tbl, N'COLUMN', @col;
    FETCH NEXT FROM cur INTO @col, @desc;
END
CLOSE cur; DEALLOCATE cur;
PRINT '[rd-change-sign] column comments updated';

/* ── ⑤ 自检 ─────────────────────────────────────────────────────────────── */
DECLARE @missing INT = (SELECT COUNT(*) FROM @fields f
    WHERE NOT EXISTS (SELECT 1 FROM yj_field x WHERE x.panel_code = N'RD_CHANGE' AND x.label = f.label));
IF @missing > 0
BEGIN
    RAISERROR(N'[rd-change-sign] 自检失败：还有 %d 个字段没登记', 16, 1, @missing);
    RETURN;
END
DECLARE @bad INT = (SELECT COUNT(*) FROM yj_field
    WHERE panel_code = N'RD_CHANGE' AND label IN (N'批准人', N'批准签字', N'批准日期')
      AND (ISNULL(editable, 1) <> 0 OR ISNULL(visible, 0) <> 1));
IF @bad > 0
BEGIN
    RAISERROR(N'[rd-change-sign] 自检失败：%d 个字段不是"只读且可见"', 16, 1, @bad);
    RETURN;
END
PRINT '[rd-change-sign] 自检通过：批准人/批准签字/批准日期 已登记为只读可见字段（备用2/3/4）。';
