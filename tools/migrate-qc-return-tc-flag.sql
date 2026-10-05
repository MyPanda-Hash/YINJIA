/* ============================================================================
 * 暂收退料单明细加「特采」bool 字段(2026-10-04 修订)
 * ----------------------------------------------------------------------------
 * ⚠ 本脚本修订同日的 migrate-qc-tc-via-return.sql 的**发起方式**:
 *   早先那版把「特采」做成暂收退料单**工具栏上的按钮**(点一下逐行生成特采单);
 *   用户口径修正为:「应该是**一个明细的 bool 字段**不是按钮,删除按钮。」
 *   ⇒ 于是:
 *      ① 暂收退料单**明细行**加「特采」是否字段(勾选=该行走特采),这就是发起方式;
 *      ② 工具栏那个「特采」按钮**删掉**(代码侧,见 PanelConfigService/ButtonService);
 *      ③ 生单时机 = **暂收退料单审核/审批通过**时,把勾了「特采」的行逐行生成特采单
 *         —— 正对用户那句「暂收退料单审批后才进入特采」。
 *
 * 链路(修订后):
 *   来料检验单审核 ─(合格行)→ 采购入库单
 *                  └(不良行)→ 暂收退料单(行带 送检数量/退货数量,并勾「特采」)
 *       暂收退料单审核/审批通过 ─→ 勾了特采的行 → 特采单(总数量=送检数量、不合格品数量=退货数量)
 *       特采单审批通过(两级) → 采购入库单(全部数量入库,特采=是)
 *
 * 本脚本(幂等):
 *   ① qc_return_detail 加 [特采] bit NOT NULL DEFAULT 0 + 中文注明;
 *   ② yj_field 登记 QC_RETURN 明细「特采」(是否=开关,seq 88,紧随 送检数量(85) / 计量单位(90) 之间);
 *   ③ 「特采」译名已有 10 语言(migrate-qc-tc-via-return.sql 已插),此处只自检不重插;
 *   ④ 自检。
 *
 * 说明:migrate-qc-tc-via-return.sql 建的 送检数量 / 暂收退料单号 / 译名 / 存量回填**全部保留**,
 *       本脚本只补「勾选开关」这一件它没有的东西 —— 两个脚本一起构成当前口径。
 * ========================================================================== */

SET NOCOUNT ON;
GO

/* ---------- ① 暂收退料单明细:特采开关 ---------- */
IF COL_LENGTH('dbo.qc_return_detail', N'特采') IS NULL
    ALTER TABLE dbo.qc_return_detail ADD [特采] bit NOT NULL CONSTRAINT DF_qc_return_detail_tc DEFAULT 0;
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
               WHERE major_id = OBJECT_ID('dbo.qc_return_detail')
                 AND minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.qc_return_detail'), N'特采', 'ColumnId')
                 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description',
        N'特采:勾选=该行做特采(让步接收)。本退料单**审核/审批通过**时,勾了的行逐行生成特采单(总数量=本行送检数量、不合格品数量=本行退货数量);特采单审批通过后全部数量进采购入库单(不走退料)',
        N'SCHEMA', N'dbo', N'TABLE', N'qc_return_detail', N'COLUMN', N'特采';
GO

/* ---------- ② yj_field 登记 ---------- */
-- seq 88:夹在 送检数量(85) 与 计量单位(90) 之间,明细网格里紧挨着,勾选时看得见送检量
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'QC_RETURN' AND col_name = N'特采'
               AND place LIKE '%detail%')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field,
                          place, seq, width, editable, required, hidden, visible)
    VALUES ('QC_RETURN', N'特采', N'特采', N'是否', NULL, NULL, NULL, NULL,
            N'detail', 88, 60, 1, 0, 0, 1);
GO

/* ---------- ③ 自检 ---------- */
IF COL_LENGTH('dbo.qc_return_detail', N'特采') IS NULL RAISERROR(N'qc_return_detail.特采 未建', 16, 1);
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
               WHERE major_id = OBJECT_ID('dbo.qc_return_detail')
                 AND minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.qc_return_detail'), N'特采', 'ColumnId')
                 AND name = 'MS_Description')
    RAISERROR(N'qc_return_detail.特采 缺中文注明', 16, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'QC_RETURN' AND col_name = N'特采'
               AND place LIKE '%detail%' AND data_type = N'是否' AND editable = 1 AND hidden = 0 AND visible = 1)
    RAISERROR(N'QC_RETURN 明细「特采」未按可编辑开关登记', 16, 1);
IF (SELECT COUNT(*) FROM yj_translation WHERE scope = 'field' AND ref_key = N'特采') < 10
    RAISERROR(N'「特采」译名不足 10 语言', 16, 1);
PRINT N'✅ 暂收退料单明细「特采」bool 字段迁移完成:列 + 中文注明 + 字段登记(可编辑开关)';
GO
