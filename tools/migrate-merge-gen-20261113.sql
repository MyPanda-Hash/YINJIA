/*
 * migrate-merge-gen-20261113.sql
 *
 * 目的:支持「采购订单 → 合单生单」(多张同供应商订单合成**一张**送料暂收单)之后的行级溯源。
 *
 * 用户口径(2026-11-13):
 *   「采购订单新增一个合单生单在生单按钮下面,可以选择同一供应商的单据,进行合单,合成一张送料暂收单。
 *     并且要注意后面的逻辑(对应的行号有的是对应采购订单行号,是合单前的行号。有些对应行号的送料暂收后的
 *     行号是送料暂收的行号,是合单后的行号)」
 *
 * 现状(取证见 tools/archive/_merge-gen-20261113/ProbeMergeCols.java):
 *   · 送料暂收行 sl_recv_detail:**已有 采购单号(行级)** + 采购订单行号 ——但 502 行里**采购单号 0 行有值**
 *     (以往一张暂收单只对应一张订单,订单号放在**表头** 采购订单号 上就够了);
 *   · 来料检验行 qc_insp_detail:只有 采购订单行号,**没有行级订单号**;
 *   · 暂收退回行 qc_return_detail:同上;
 *   · 采购入库行 bl_purchase_in:只有 源单行号(标签「采购订单行号」),没有行级订单号 ——
 *     而转ERP 取的是**表头** 采购订单号 作 src_bill_no(KingdeePushService),
 *     合单后一张入库单会跨多张采购订单 ⇒ 行级订单号必须存在,否则 src_bill_no 会挂错单。
 *
 * 本脚本做三件事:
 *   ① 给 来料检验行 / 暂收退回行 / 采购入库行 各加一列 **采购单号**(行级,= 该行来源的采购订单号);
 *   ② 登记 yj_field(可见,排在「采购订单行号」右侧)+ en 译名;
 *   ③ 补 MS_Description 中文注明(项目硬规范)。
 *
 * 语义边界(合单前后的行号,别混):
 *   · **采购订单行号** = 合单**前**的行号(来源采购订单上的 行号) —— 逐站带下去,转ERP 作 src_seq;
 *   · **采购单号**     = 合单**前**的订单号(行级),用于在合单后的单据里认出"这一行原来属于哪张订单";
 *   · **暂收单自己的行 id / form_flow_link.source_line_key** = 合单**后**的行标识(暂收行 id),
 *     下游占用/反查一律走它,不吃 采购单号。
 *
 * 幂等:先判 COL_LENGTH / EXISTS 再动;两账套各跑一遍。
 */

SET NOCOUNT ON;
SET XACT_ABORT ON;

/* ── ① 物理列:采购单号(行级) ─────────────────────────────────── */
IF COL_LENGTH('qc_insp_detail', '采购单号') IS NULL
BEGIN
    ALTER TABLE qc_insp_detail ADD [采购单号] nvarchar(200) NULL;
    PRINT '[merge-gen] qc_insp_detail.采购单号 added';
END ELSE PRINT '[merge-gen] qc_insp_detail.采购单号 exists, skip';

IF COL_LENGTH('qc_return_detail', '采购单号') IS NULL
BEGIN
    ALTER TABLE qc_return_detail ADD [采购单号] nvarchar(200) NULL;
    PRINT '[merge-gen] qc_return_detail.采购单号 added';
END ELSE PRINT '[merge-gen] qc_return_detail.采购单号 exists, skip';

IF COL_LENGTH('bl_purchase_in', '采购单号') IS NULL
BEGIN
    ALTER TABLE bl_purchase_in ADD [采购单号] nvarchar(200) NULL;
    PRINT '[merge-gen] bl_purchase_in.采购单号 added';
END ELSE PRINT '[merge-gen] bl_purchase_in.采购单号 exists, skip';

/* ── ② 中文注明 ─────────────────────────────────────────────────── */
DECLARE @tbl SYSNAME, @col SYSNAME, @desc NVARCHAR(300), @sql NVARCHAR(MAX);

DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
    SELECT * FROM (VALUES
        ('qc_insp_detail', N'采购单号', N'来料检验行的来源采购订单号(行级)。合单生单后一张暂收单可能跨多张采购订单,靠它与「采购订单行号」一起认出本行原属哪张订单的哪一行。'),
        ('qc_return_detail', N'采购单号', N'暂收退回行的来源采购订单号(行级),口径同来料检验行。'),
        ('bl_purchase_in', N'采购单号', N'采购入库行的来源采购订单号(行级)。转ERP 时用它作金蝶 src_bill_no(行级优先于表头「采购订单号」),合单后一张入库单跨多张订单也挂得对。')
    ) AS v(tbl, col, descr);

OPEN cur;
FETCH NEXT FROM cur INTO @tbl, @col, @desc;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF EXISTS (SELECT 1 FROM sys.extended_properties
               WHERE major_id = OBJECT_ID(@tbl) AND minor_id = COLUMNPROPERTY(OBJECT_ID(@tbl), @col, 'ColumnId')
                 AND name = N'MS_Description')
    BEGIN
        EXEC sp_dropextendedproperty N'MS_Description', N'SCHEMA', N'dbo', N'TABLE', @tbl, N'COLUMN', @col;
    END
    SET @sql = N'EXEC sp_addextendedproperty N''MS_Description'', @value = N''' + REPLACE(@desc, '''', '''''')
             + N''', @level0type = N''SCHEMA'', @level0name = N''dbo'', @level1type = N''TABLE'', @level1name = N'''
             + @tbl + N''', @level2type = N''COLUMN'', @level2name = N''' + @col + N'''';
    EXEC sp_executesql @sql;
    PRINT '[merge-gen] MS_Description set: ' + @tbl + '.' + @col;
    FETCH NEXT FROM cur INTO @tbl, @col, @desc;
END
CLOSE cur; DEALLOCATE cur;

/* ── ③ 字段元数据:三张行的「采购单号」(紧挨各单的「采购订单行号」右侧)── */
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_INSP' AND label = N'采购单号' AND place = N'detail')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible, label_en)
    VALUES (N'QC_INSP', N'采购单号', N'采购单号', N'文本', N'detail', 41, 140, 0, 0, 0, 1, N'Src PO No.');

IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_RETURN' AND label = N'采购单号' AND place = N'detail')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible, label_en)
    VALUES (N'QC_RETURN', N'采购单号', N'采购单号', N'文本', N'detail', 101, 140, 0, 0, 0, 1, N'Src PO No.');

IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'PURCHASE_IN' AND label = N'采购单号' AND place = N'detail')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible, label_en)
    VALUES (N'PURCHASE_IN', N'采购单号', N'采购单号', N'文本', N'detail', 291, 140, 0, 0, 0, 1, N'Src PO No.');

/* ── ④ 多语言(AGENTS.md 多语言强制规范) ───────────────────────── */
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'采购单号' AND locale = N'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source)
    VALUES (N'field', N'采购单号', N'en', N'Src PO No.', N'manual');

/* ── ⑤ 自检 ───────────────────────────────────────────────────── */
DECLARE @missing INT = 0;
IF COL_LENGTH('qc_insp_detail', '采购单号') IS NULL SET @missing = @missing + 1;
IF COL_LENGTH('qc_return_detail', '采购单号') IS NULL SET @missing = @missing + 1;
IF COL_LENGTH('bl_purchase_in', '采购单号') IS NULL SET @missing = @missing + 1;
IF @missing > 0
BEGIN
    RAISERROR(N'[merge-gen] 自检失败:仍有 %d 张表缺 采购单号 列', 16, 1, @missing);
    RETURN;
END

DECLARE @fld INT = (SELECT COUNT(*) FROM yj_field WHERE label = N'采购单号' AND place = N'detail'
                    AND panel_code IN (N'QC_INSP', N'QC_RETURN', N'PURCHASE_IN') AND visible = 1);
IF @fld <> 3
    RAISERROR(N'[merge-gen] 自检失败:检验/退回/入库 的可见「采购单号」字段行数为 %d,预期 3 行', 16, 1, @fld);

PRINT '[merge-gen] 自检通过:行级采购单号就位(QC_INSP / QC_RETURN / PURCHASE_IN)。';
