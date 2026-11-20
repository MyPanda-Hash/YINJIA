/* migrate-qc-bhc-ship-insp-link-20261120.sql(2026-11-20)
 *
 * 用户口径:「品质相关所有检验记录选择不合格都需要跳转至相关流程单据，当前出货检验（功能）就是转到
 *   不合格处理（制程）……当前不合格处理单据存在缺少对应的关联字段，为当前不合格处理（制程）的单据
 *   增加字段可关联到出货检验(功能）和对应的生产工单。」追问确认:目标单据 = 不合格品处理单(制程)
 *   QC_BHC(YJ-QR-59);入口只做出货检验（功能）/（表观）两张。
 *
 * 做法(与 2026-11-01「不合格报告→制程检验单 / 不合格品处理单→不合格报告」同一套参照字段契约):
 *   · qc_bhc 加「出货检验单号」→ 参照 QC_PROC_INSP(出货检验（功能）).单据编号;
 *   · qc_bhc 加「工单号」→ 文本(与 QC 其余单据 / 工单追溯同口径,按这一串工单号关联生产工单;
 *     工单行号在来源检验单上,本单纸面不另开格);
 *   · 纸面版式在 frontend/src/core/views/docSheetConfigs.js(QC_BHC 第 1/3 行各补一格,不加行);
 *     同名(工单号/客户名称/产品编码/产品名称)由后端 refMap 自动带回,异名(产品规格←规格型号、
 *     生产量←检验数量)由纸面 refCarry 声明。
 *   · 「判定不合格 → 去开不合格品处理单」按钮与建单接口见 QcProcInspSheet.vue /
 *     PanelxList.openNgDisposition / QcShipInspNgController(POST /api/qc/shipInsp/ng,幂等:
 *     同一检验单只留一张存活处理单,按本列 出货检验单号 判重)。
 *
 * ⚠ 参照候选**不要**按单据状态过滤:纸面单据表头「单据状态」是历史遗留列(MES 真源是 yj_doc_status),
 *   纸面配置里已标 refAllStatus;本脚本不写 ref_filter。
 *
 * 规范:qc_ 前缀 = 品质管理单据;只给既有表加列(列名即中文标签,ADR-0001 数据键永不翻译);
 *   新列写 MS_Description 中文注明;yj_field 字段译名按 AGENTS 多语言规范补 en/zh-TW。
 *   幂等:加列 IF COL_LENGTH IS NULL、注明 IF NOT EXISTS、字段/译名 INSERT NOT EXISTS;两账套均执行。
 */
SET NOCOUNT ON;
GO
IF DB_NAME() = N'master' USE HSDZ_MES;
GO

/* ============ A. 物理列(列名=中文标签,与其它数据键同口径) ============ */
IF COL_LENGTH(N'dbo.qc_bhc', N'出货检验单号') IS NULL
BEGIN
    ALTER TABLE dbo.qc_bhc ADD [出货检验单号] nvarchar(60) NULL;
    PRINT N'[OK] qc_bhc.[出货检验单号] 已加';
END
ELSE PRINT N'[SKIP] qc_bhc.[出货检验单号] 已存在';
GO
IF COL_LENGTH(N'dbo.qc_bhc', N'工单号') IS NULL
BEGIN
    ALTER TABLE dbo.qc_bhc ADD [工单号] nvarchar(50) NULL;
    PRINT N'[OK] qc_bhc.[工单号] 已加';
END
ELSE PRINT N'[SKIP] qc_bhc.[工单号] 已存在';
GO

/* ============ B. 列中文注明 ============ */
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
               WHERE major_id = OBJECT_ID(N'dbo.qc_bhc')
                 AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.qc_bhc'), N'出货检验单号', 'ColumnId')
                 AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description',
        N'出货检验单号:关联的出货检验单号(功能单 QC_PROC_INSP 的 ZC 号,表观单 QC_ASM_INSP 的 ZJ 号;参照源=功能单);选中/自动建单时带出工单号/客户/产品/规格/生产量',
        N'SCHEMA', N'dbo', N'TABLE', N'qc_bhc', N'COLUMN', N'出货检验单号';
ELSE
    EXEC sp_updateextendedproperty N'MS_Description',
        N'出货检验单号:关联的出货检验单号(功能单 QC_PROC_INSP 的 ZC 号,表观单 QC_ASM_INSP 的 ZJ 号;参照源=功能单);选中/自动建单时带出工单号/客户/产品/规格/生产量',
        N'SCHEMA', N'dbo', N'TABLE', N'qc_bhc', N'COLUMN', N'出货检验单号';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
               WHERE major_id = OBJECT_ID(N'dbo.qc_bhc')
                 AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.qc_bhc'), N'工单号', 'ColumnId')
                 AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description',
        N'工单号:对应的生产工单号(plang.pl_no),与检验单/工单追溯同口径;由出货检验单带入,也可手工填',
        N'SCHEMA', N'dbo', N'TABLE', N'qc_bhc', N'COLUMN', N'工单号';
ELSE
    EXEC sp_updateextendedproperty N'MS_Description',
        N'工单号:对应的生产工单号(plang.pl_no),与检验单/工单追溯同口径;由出货检验单带入,也可手工填',
        N'SCHEMA', N'dbo', N'TABLE', N'qc_bhc', N'COLUMN', N'工单号';
GO

/* ============ C. yj_field 字段登记 ============ */
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_BHC' AND col_name = N'出货检验单号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field,
                          place, seq, width, editable, required, hidden, visible)
    VALUES (N'QC_BHC', N'出货检验单号', N'出货检验单号', N'参照', NULL, N'QC_PROC_INSP', N'单据编号', N'单据编号',
            N'header', 26, 160, 1, 0, 0, 1);
GO
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_BHC' AND col_name = N'工单号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field,
                          place, seq, width, editable, required, hidden, visible)
    VALUES (N'QC_BHC', N'工单号', N'工单号', N'文本', NULL, NULL, NULL, NULL,
            N'header', 27, 140, 1, 0, 0, 1);
GO

/* ============ D. 字段译名(AGENTS:新增字段必须同时给 yj_translation,至少 en) ============ */
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'出货检验单号' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source)
    VALUES ('field', N'出货检验单号', 'en', N'Outgoing Inspection Sheet No.', 'manual');
GO
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'出货检验单号' AND locale = 'zh-TW')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source)
    VALUES ('field', N'出货检验单号', 'zh-TW', N'出貨檢驗單號', 'manual');
GO
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'工单号' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source)
    VALUES ('field', N'工单号', 'en', N'Work Order No.', 'manual');
GO
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'工单号' AND locale = 'zh-TW')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source)
    VALUES ('field', N'工单号', 'zh-TW', N'工單號', 'manual');
GO

/* ============ E. 自检(硬闸门:任一项不成立即 RAISERROR 16 停手) ============ */
DECLARE @db sysname = DB_NAME();
IF COL_LENGTH(N'dbo.qc_bhc', N'出货检验单号') IS NOT NULL
   AND COL_LENGTH(N'dbo.qc_bhc', N'工单号') IS NOT NULL
   AND EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_BHC' AND col_name = N'出货检验单号'
                                         AND data_type = N'参照' AND ref_panel = N'QC_PROC_INSP' AND ref_field = N'单据编号')
   AND EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_BHC' AND col_name = N'工单号'
                                         AND data_type = N'文本' AND place = N'header' AND visible = 1)
   AND (SELECT COUNT(*) FROM sys.extended_properties
        WHERE major_id = OBJECT_ID(N'dbo.qc_bhc') AND name = N'MS_Description'
          AND minor_id IN (COLUMNPROPERTY(OBJECT_ID(N'dbo.qc_bhc'), N'出货检验单号', 'ColumnId'),
                           COLUMNPROPERTY(OBJECT_ID(N'dbo.qc_bhc'), N'工单号', 'ColumnId'))) = 2
   AND (SELECT COUNT(*) FROM yj_translation WHERE scope = 'field'
            AND ref_key IN (N'出货检验单号', N'工单号') AND locale IN ('en', 'zh-TW')) >= 4
    RAISERROR(N'[PASS] %s 不合格品处理单(制程)关联字段已就绪(2 列 + 2 yj_field + 译名)', 10, 1, @db);
ELSE
    RAISERROR(N'[FAIL] %s 不合格品处理单(制程)关联字段自检未通过', 16, 1, @db);
GO
