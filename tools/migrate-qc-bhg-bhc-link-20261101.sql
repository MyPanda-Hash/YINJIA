/* migrate-qc-bhg-bhc-link-20261101.sql(2026-11-01)
 *
 * 用户口径:「不合格报告(制程)要关联制程检验单,不合格品处理单(制程)要关联不合格报告(制程),
 *   最后不合格品处理单(自制物料)先不管」;追问后明确「不需要自动生单,能实现关联对应的单号
 *   然后带入数据即可」。
 *
 * 做法:纯**参照字段**(与「暂收退回单.检验单号 → 来料检验单」「来料检验单.暂收单号 → 送料暂收单」
 *   同一套 yj_field 契约),不动任何自动生单/审核钩子:
 *   · QC_BHG(不合格报告(制程) YJ-QR-11)头表 qc_bhg 加「制程检验单号」→ 参照 QC_PROC_INSP.单据编号;
 *   · QC_BHC(不合格品处理单(制程) YJ-QR-59)头表 qc_bhc 加「不合格报告单号」→ 参照 QC_BHG.单据编号;
 *   · 纸面版式单元格与「带入哪些字段」在前端 docSheetConfigs.js(DocSheet 配置驱动);
 *     同名字段由后端 refMap 自动带回,异名字段(检验工站←工序 / 异常产品规格←规格型号 /
 *     异常时间←单据日期 / 产品规格←异常产品规格 / 问题描述←异常描述)由纸面配置里的 refCarry 显式声明。
 *   · 不合格品处理单(自制物料) QC_BHZ **本批不动**(用户口径「先不管」)。
 *
 * ⚠ 参照候选**不要**按单据状态过滤:通用参照会在来源面板有「审核/提交审批」按钮时自动加
 *   condition[单据状态]=已审核(前端 engine.queryRefRows),而这三张纸面单据的**表头 单据状态 列是
 *   历史遗留列**:MES 侧从不维护它(真源是 yj_doc_status,列表/纸面的状态是派生值)。实测
 *   qc_proc_insp_head:433 张单里只有 1 张表头列写着「已审核」⇒ 一过滤就只剩 1 条候选(等于不可用)。
 *   故这两格在纸面配置里标 refAllStatus,由 DocSheet 透传给参照弹窗跳过该状态过滤(候选在弹窗里
 *   仍按派生状态显示,用户自己认单);本脚本**不写** ref_filter。
 *
 * 规范:qc_ 前缀 = 品质管理单据;只给既有表加列(列名即中文标签,ADR-0001 数据键永不翻译);
 *   新列写 MS_Description 中文注明(全量部署规范);yj_field 字段译名按 AGENTS 多语言规范补 en。
 *   幂等:加列 IF COL_LENGTH IS NULL、注明 IF NOT EXISTS、字段/译名 INSERT NOT EXISTS;两账套均执行。
 */
SET NOCOUNT ON;
GO
IF DB_NAME() = N'master' USE HSDZ_MES;
GO

/* ============ A. 物理列(列名=中文标签,与其它数据键同口径) ============ */
IF COL_LENGTH(N'dbo.qc_bhg', N'制程检验单号') IS NULL
BEGIN
    ALTER TABLE dbo.qc_bhg ADD [制程检验单号] nvarchar(60) NULL;
    PRINT N'[OK] qc_bhg.[制程检验单号] 已加';
END
ELSE PRINT N'[SKIP] qc_bhg.[制程检验单号] 已存在';
GO
IF COL_LENGTH(N'dbo.qc_bhc', N'不合格报告单号') IS NULL
BEGIN
    ALTER TABLE dbo.qc_bhc ADD [不合格报告单号] nvarchar(60) NULL;
    PRINT N'[OK] qc_bhc.[不合格报告单号] 已加';
END
ELSE PRINT N'[SKIP] qc_bhc.[不合格报告单号] 已存在';
GO

/* ============ B. 列中文注明 ============ */
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
               WHERE major_id = OBJECT_ID(N'dbo.qc_bhg') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.qc_bhg'), N'制程检验单号', 'ColumnId')
                 AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description',
        N'制程检验单号:关联的制程检验单(QC_PROC_INSP)单据编号,参照字段;选中后带出工序/规格型号/单据日期等',
        N'SCHEMA', N'dbo', N'TABLE', N'qc_bhg', N'COLUMN', N'制程检验单号';
ELSE
    EXEC sp_updateextendedproperty N'MS_Description',
        N'制程检验单号:关联的制程检验单(QC_PROC_INSP)单据编号,参照字段;选中后带出工序/规格型号/单据日期等',
        N'SCHEMA', N'dbo', N'TABLE', N'qc_bhg', N'COLUMN', N'制程检验单号';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
               WHERE major_id = OBJECT_ID(N'dbo.qc_bhc') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.qc_bhc'), N'不合格报告单号', 'ColumnId')
                 AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description',
        N'不合格报告单号:关联的不合格报告(制程)(QC_BHG)单据编号,参照字段;选中后带出客户/产品/不合格数量/原因分析等',
        N'SCHEMA', N'dbo', N'TABLE', N'qc_bhc', N'COLUMN', N'不合格报告单号';
ELSE
    EXEC sp_updateextendedproperty N'MS_Description',
        N'不合格报告单号:关联的不合格报告(制程)(QC_BHG)单据编号,参照字段;选中后带出客户/产品/不合格数量/原因分析等',
        N'SCHEMA', N'dbo', N'TABLE', N'qc_bhc', N'COLUMN', N'不合格报告单号';
GO

/* ============ C. yj_field 字段登记(data_type=参照;ref_field/display_field 都取目标面板的「单据编号」) ============ */
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_BHG' AND col_name = N'制程检验单号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field,
                          place, seq, width, editable, required, hidden, visible)
    VALUES (N'QC_BHG', N'制程检验单号', N'制程检验单号', N'参照', NULL, N'QC_PROC_INSP', N'单据编号', N'单据编号',
            N'header', 25, 160, 1, 0, 0, 1);
GO
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_BHC' AND col_name = N'不合格报告单号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field,
                          place, seq, width, editable, required, hidden, visible)
    VALUES (N'QC_BHC', N'不合格报告单号', N'不合格报告单号', N'参照', NULL, N'QC_BHG', N'单据编号', N'单据编号',
            N'header', 25, 160, 1, 0, 0, 1);
GO

/* ============ D. 字段译名(AGENTS:新增字段必须同时给 yj_translation,至少 en) ============ */
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'制程检验单号' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source)
    VALUES ('field', N'制程检验单号', 'en', N'Process Inspection No.', 'manual');
GO
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'制程检验单号' AND locale = 'zh-TW')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source)
    VALUES ('field', N'制程检验单号', 'zh-TW', N'製程檢驗單號', 'manual');
GO
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'不合格报告单号' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source)
    VALUES ('field', N'不合格报告单号', 'en', N'Nonconformance Report No.', 'manual');
GO
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'不合格报告单号' AND locale = 'zh-TW')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source)
    VALUES ('field', N'不合格报告单号', 'zh-TW', N'不合格報告單號', 'manual');
GO

/* ============ E. 自检(硬闸门:任一项不成立即 RAISERROR 16 停手) ============ */
DECLARE @db sysname = DB_NAME();
IF COL_LENGTH(N'dbo.qc_bhg', N'制程检验单号') IS NOT NULL
   AND COL_LENGTH(N'dbo.qc_bhc', N'不合格报告单号') IS NOT NULL
   AND EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_BHG' AND col_name = N'制程检验单号'
                                         AND ref_panel = N'QC_PROC_INSP' AND ref_field = N'单据编号')
   AND EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_BHC' AND col_name = N'不合格报告单号'
                                         AND ref_panel = N'QC_BHG' AND ref_field = N'单据编号')
   AND (SELECT COUNT(*) FROM yj_translation WHERE scope = 'field'
            AND ref_key IN (N'制程检验单号', N'不合格报告单号') AND locale IN ('en', 'zh-TW')) = 4
    RAISERROR(N'[PASS] %s 关联字段已就绪(2 列 + 2 yj_field + 4 译名)', 10, 1, @db);
ELSE
    RAISERROR(N'[FAIL] %s 关联字段自检未通过', 16, 1, @db);
GO
