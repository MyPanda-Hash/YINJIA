/* migrate-qc-bhcp-finished-20261124.sql(2026-11-24)
 *
 * 用户口径(2026-11-24):
 *   「修改为弹窗跳转,当前的功能就转向当前的不合格处理(制程),表观就转向不合格处理(成品),
 *     要求需要实现当前的不合格处理数量能影响到后面的产成品入库的实际数量。也就是这些内容都和工单相关联。」
 *
 * 落地(本脚本 = 数据库部分):
 *   A. 新建《不合格品处理单(成品)》表对:qc_bhc_cp(头) + qc_bhc_cp_detail(行)
 *      —— 结构照《不合格品处理单(制程)》qc_bhc / qc_bhc_detail 逐列复制,
 *         「出货检验单号」改指表观单 QC_ASM_INSP,并补 工单行号 / 批次号 两个关联字段。
 *   B. 给 qc_bhc(制程)补 工单行号 / 批次号 —— 产成品入库扣减要按「工单号+工单行号(+批次)」归集两张 NG 单。
 *   C. yj_panel 登记 QC_BHCP(doc 面板,单号前缀 BHCP,20 条/页,所属 品质管理)。
 *   D. yj_field:QC_BHCP 逐列登记(照 QC_BHC,出货检验单号→参照 QC_ASM_INSP,新增 工单行号/批次号);
 *      QC_BHC 补登记 工单行号/批次号。
 *   E. yj_role_panel 授权:照 QC_BHC 的角色集与权限词逐角色复制(两级审批:审批人=超级管理员口径)。
 *   F. 多语言:面板名 10 语言 + 新字段 label_en。
 *   G. 中文注明:表 + 关键列。
 *   H. 自检。
 *
 * 幂等:表/列/面板/字段/授权/译名全部守卫;两账套:HSDZ_MES → HSDZ_MES_TEST。
 * ⚠ 纸面编号(文档编号)暂用「YJ-QR-59-成品」作占位 —— 正式受控编号确定后,改本脚本默认值 +
 *   frontend/src/core/views/docSheetConfigs.js 的 QC_BHCP.docno 两处即可。
 * ========================================================================== */
SET NOCOUNT ON;
GO
IF DB_NAME() = N'master' USE HSDZ_MES;
GO
PRINT N'== migrate-qc-bhcp-finished-20261124 ==';
GO

/* ═════════ A1. 成品不合格品处理单 头表 ═════════ */
IF OBJECT_ID(N'dbo.qc_bhc_cp', N'U') IS NULL
CREATE TABLE dbo.qc_bhc_cp (
    [id]                   int IDENTITY(1,1) NOT NULL,
    [单据编号]             nvarchar(60)  NOT NULL,
    [单据日期]             nvarchar(20)  NULL,
    [文档编号]             nvarchar(30)  NOT NULL CONSTRAINT DF_qc_bhc_cp_docno DEFAULT (N'YJ-QR-59-成品'),
    [客户名称]             nvarchar(200) NULL,
    [产品编码]             nvarchar(100) NULL,
    [产品名称]             nvarchar(200) NULL,
    [产品规格]             nvarchar(200) NULL,
    [生产量]               decimal(18,4) NULL,
    [不合格品数量]         decimal(18,4) NULL,
    [不合格品比例]         nvarchar(20)  NULL,
    [问题来源]             nvarchar(20)  NULL,
    [责任人]               nvarchar(50)  NULL,
    [问题描述]             nvarchar(2000) NULL,
    [原因分析]             nvarchar(2000) NULL,
    [性能验证]             nvarchar(1000) NULL,
    [处理意见]             nvarchar(20)  NULL,
    [产品开发部性能意见]   nvarchar(500) NULL,
    [产品开发部工艺意见]   nvarchar(500) NULL,
    [销售部意见]           nvarchar(500) NULL,
    [改善效果验证]         nvarchar(1000) NULL,
    [材料费用]             decimal(18,2) NULL,
    [人工费]               decimal(18,2) NULL,
    [其他费用]             decimal(18,2) NULL,
    [备注]                 nvarchar(500) NULL,
    [单据状态]             nvarchar(10)  NOT NULL CONSTRAINT DF_qc_bhc_cp_state DEFAULT (N'草稿'),
    [审核人]               nvarchar(50)  NULL,
    [审核时间]             nvarchar(30)  NULL,
    [审批人]               nvarchar(50)  NULL,
    [审批时间]             nvarchar(30)  NULL,
    [asp_user1]            nvarchar(50)  NULL,
    [asp_time1]            datetime2     NULL,
    [asp_user2]            nvarchar(50)  NULL,
    [asp_time2]            datetime2     NULL,
    [asp_cancel]           char(1)       NULL CONSTRAINT DF_qc_bhc_cp_cancel DEFAULT ('N'),
    [备用1]                nvarchar(500) NULL,
    [备用2]                nvarchar(500) NULL,
    [备用3]                nvarchar(500) NULL,
    [备用4]                nvarchar(500) NULL,
    [备用5]                nvarchar(500) NULL,
    [备用6]                nvarchar(500) NULL,
    [备用7]                nvarchar(500) NULL,
    [备用8]                nvarchar(500) NULL,
    [备用9]                nvarchar(500) NULL,
    [备用10]               nvarchar(500) NULL,
    [备用11]               nvarchar(500) NULL,
    [备用12]               nvarchar(500) NULL,
    [备用13]               nvarchar(500) NULL,
    [备用14]               nvarchar(500) NULL,
    [备用15]               nvarchar(500) NULL,
    [备用16]               nvarchar(500) NULL,
    [备用17]               nvarchar(500) NULL,
    [备用18]               nvarchar(500) NULL,
    [备用19]               nvarchar(500) NULL,
    [备用20]               nvarchar(500) NULL,
    [不合格报告单号]       nvarchar(60)  NULL,
    [责任部门]             nvarchar(100) NULL,
    [附件]                 nvarchar(500) NULL,
    /* 关联三键:出货检验(表观)单号 + 工单号 + 工单行号 + 批次(产成品入库按这三键扣减) */
    [出货检验单号]         nvarchar(60)  NULL,
    [工单号]               nvarchar(50)  NULL,
    [工单行号]             int           NULL,
    [批次号]               nvarchar(40)  NULL,
    [问题描述责任人]       nvarchar(100) NULL,
    [原因分析责任人]       nvarchar(100) NULL,
    [性能验证责任人]       nvarchar(100) NULL,
    [处理意见责任人]       nvarchar(100) NULL,
    [改善效果验证责任人]   nvarchar(100) NULL,
    CONSTRAINT PK_qc_bhc_cp PRIMARY KEY CLUSTERED ([id])
);
GO
IF OBJECT_ID(N'dbo.qc_bhc_cp', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.qc_bhc_cp') AND name = N'IX_qc_bhc_cp_no')
    CREATE INDEX IX_qc_bhc_cp_no ON dbo.qc_bhc_cp ([单据编号]);
GO

/* ═════════ A2. 成品不合格品处理单 行表(照 qc_bhc_detail:单表式纸面,行表只留审计四件套 + 备用列池) ═════════ */
IF OBJECT_ID(N'dbo.qc_bhc_cp_detail', N'U') IS NULL
CREATE TABLE dbo.qc_bhc_cp_detail (
    [id]         int IDENTITY(1,1) NOT NULL,
    [单据编号]   nvarchar(60)  NULL,
    [asp_cancel] char(1)       NULL CONSTRAINT DF_qc_bhc_cp_d_cancel DEFAULT ('N'),
    [asp_user1]  nvarchar(50)  NULL,
    [asp_user2]  nvarchar(50)  NULL,
    [asp_time1]  datetime2     NULL,
    [asp_time2]  datetime2     NULL,
    [备用1]  nvarchar(500) NULL, [备用2]  nvarchar(500) NULL, [备用3]  nvarchar(500) NULL,
    [备用4]  nvarchar(500) NULL, [备用5]  nvarchar(500) NULL, [备用6]  nvarchar(500) NULL,
    [备用7]  nvarchar(500) NULL, [备用8]  nvarchar(500) NULL, [备用9]  nvarchar(500) NULL,
    [备用10] nvarchar(500) NULL, [备用11] nvarchar(500) NULL, [备用12] nvarchar(500) NULL,
    [备用13] nvarchar(500) NULL, [备用14] nvarchar(500) NULL, [备用15] nvarchar(500) NULL,
    [备用16] nvarchar(500) NULL, [备用17] nvarchar(500) NULL, [备用18] nvarchar(500) NULL,
    [备用19] nvarchar(500) NULL, [备用20] nvarchar(500) NULL,
    CONSTRAINT PK_qc_bhc_cp_detail PRIMARY KEY CLUSTERED ([id])
);
GO

/* ═════════ B. 制程单补关联字段(产成品入库扣减要按 工单行号/批次 归集) ═════════ */
IF COL_LENGTH(N'dbo.qc_bhc', N'工单行号') IS NULL
    ALTER TABLE dbo.qc_bhc ADD [工单行号] int NULL;
IF COL_LENGTH(N'dbo.qc_bhc', N'批次号') IS NULL
    ALTER TABLE dbo.qc_bhc ADD [批次号] nvarchar(40) NULL;
GO

/* ═════════ C. 面板登记(doc 单表式;单号前缀 BHCP) ═════════ */
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = N'QC_BHCP')
INSERT INTO yj_panel (panel_code, panel_name, panel_name_en, category, mode, head_table, line_table, group_col, pk_col,
                      code_col, prefix, date_col, page_size, detail_key, module_group)
VALUES (N'QC_BHCP', N'不合格品处理单(成品)', N'Nonconforming Product Disposition (Finished Goods)',
        N'单据', N'doc', N'qc_bhc_cp', N'qc_bhc_cp_detail', N'单据编号', N'id',
        N'单据编号', N'BHCP', N'单据日期', 20, N'items', N'品质管理');
/* 幂等收口 */
UPDATE yj_panel
   SET panel_name = N'不合格品处理单(成品)', panel_name_en = N'Nonconforming Product Disposition (Finished Goods)',
       category = N'单据', mode = N'doc', head_table = N'qc_bhc_cp', line_table = N'qc_bhc_cp_detail',
       group_col = N'单据编号', code_col = N'单据编号', prefix = N'BHCP', date_col = N'单据日期',
       page_size = 20, detail_key = N'items', module_group = N'品质管理'
 WHERE panel_code = N'QC_BHCP';
GO

/* ═════════ D. 字段登记 ═════════
   col_name 必须 = 物理列名;label 与 col_name 同名(质量单据一族的口径)。
   ref_panel:出货检验单号 → QC_ASM_INSP(表观);不合格报告单号 → QC_BHG。 */
DECLARE @f TABLE (place varchar(60), seq int, col_name sysname, data_type nvarchar(40),
                  ref_panel nvarchar(128) NULL, ref_field nvarchar(128) NULL, display_field nvarchar(128) NULL,
                  editable bit, required bit, hidden bit, visible bit, width int);
INSERT INTO @f (place, seq, col_name, data_type, ref_panel, ref_field, display_field, editable, required, hidden, visible, width) VALUES
 (N'query,header',  10, N'单据编号',   N'文本',   NULL, NULL, NULL, 0, 1, 0, 1, 140),
 (N'query,header',  20, N'单据日期',   N'日期',   NULL, NULL, NULL, 0, 1, 0, 1, 120),
 (N'header',        25, N'不合格报告单号', N'参照', N'QC_BHG', N'单据编号', N'单据编号', 1, 0, 0, 1, 160),
 (N'header',        26, N'出货检验单号', N'参照', N'QC_ASM_INSP', N'单据编号', N'单据编号', 1, 0, 0, 1, 160),
 (N'header',        27, N'工单号',     N'文本',   NULL, NULL, NULL, 1, 0, 0, 1, 140),
 (N'header',        28, N'工单行号',   N'整数',   NULL, NULL, NULL, 0, 0, 0, 1,  90),
 (N'header',        29, N'批次号',     N'文本',   NULL, NULL, NULL, 1, 0, 0, 1, 130),
 (N'query,header',  30, N'客户名称',   N'参照',   N'KHDA', N'mc', N'mc', 1, 0, 0, 1, 160),
 (N'query,header',  40, N'产品编码',   N'文本',   NULL, NULL, NULL, 1, 0, 0, 1, 130),
 (N'header',        50, N'产品名称',   N'文本',   NULL, NULL, NULL, 1, 0, 0, 1, 160),
 (N'header',        60, N'产品规格',   N'文本',   NULL, NULL, NULL, 1, 0, 0, 1, 140),
 (N'header',        70, N'生产量',     N'小数',   NULL, NULL, NULL, 1, 0, 0, 1, 100),
 (N'header',        80, N'不合格品数量', N'小数', NULL, NULL, NULL, 1, 0, 0, 1, 110),
 (N'header',        90, N'不合格品比例', N'文本', NULL, NULL, NULL, 1, 0, 0, 1, 110),
 (N'query,header', 100, N'问题来源',   N'下拉框', NULL, NULL, NULL, 1, 0, 0, 1, 100),
 (N'header',       110, N'责任人',     N'文本',   NULL, NULL, NULL, 1, 0, 0, 1, 100),
 (N'header',       111, N'问题描述责任人', N'文本', NULL, NULL, NULL, 1, 0, 0, 1, 100),
 (N'header',       112, N'原因分析责任人', N'文本', NULL, NULL, NULL, 1, 0, 0, 1, 100),
 (N'header',       113, N'性能验证责任人', N'文本', NULL, NULL, NULL, 1, 0, 0, 1, 100),
 (N'header',       114, N'处理意见责任人', N'文本', NULL, NULL, NULL, 1, 0, 0, 1, 100),
 (N'header',       115, N'改善效果验证责任人', N'文本', NULL, NULL, NULL, 1, 0, 0, 1, 100),
 (N'header',       120, N'问题描述',   N'文本',   NULL, NULL, NULL, 1, 0, 0, 1, 400),
 (N'header',       130, N'原因分析',   N'文本',   NULL, NULL, NULL, 1, 0, 0, 1, 400),
 (N'header',       140, N'性能验证',   N'文本',   NULL, NULL, NULL, 1, 0, 0, 1, 300),
 (N'query,header', 150, N'处理意见',   N'下拉框', NULL, NULL, NULL, 1, 0, 0, 1, 150),
 (N'header',       160, N'产品开发部性能意见', N'文本', NULL, NULL, NULL, 1, 0, 0, 1, 260),
 (N'header',       170, N'产品开发部工艺意见', N'文本', NULL, NULL, NULL, 1, 0, 0, 1, 260),
 (N'header',       180, N'销售部意见', N'文本',   NULL, NULL, NULL, 1, 0, 0, 1, 240),
 (N'header',       182, N'责任部门',   N'文本',   NULL, NULL, NULL, 0, 0, 0, 1, 120),
 (N'header',       190, N'改善效果验证', N'文本', NULL, NULL, NULL, 1, 0, 0, 1, 300),
 (N'header',       200, N'材料费用',   N'小数',   NULL, NULL, NULL, 1, 0, 0, 1, 110),
 (N'header',       210, N'人工费',     N'小数',   NULL, NULL, NULL, 1, 0, 0, 1, 100),
 (N'header',       220, N'其他费用',   N'小数',   NULL, NULL, NULL, 1, 0, 0, 1, 100),
 (N'header',       230, N'备注',       N'文本',   NULL, NULL, NULL, 1, 0, 0, 1, 220),
 (N'query,header', 240, N'单据状态',   N'文本',   NULL, NULL, NULL, 0, 0, 0, 1,  90),
 (N'header',       250, N'审核人',     N'参照',   N'EMP', N'员工名称', N'员工名称', 0, 0, 0, 1,  90),
 (N'header',       260, N'审核时间',   N'文本',   NULL, NULL, NULL, 0, 0, 0, 1, 140),
 (N'header',       261, N'审批人',     N'文本',   NULL, NULL, NULL, 0, 0, 0, 1,  90),
 (N'header',       262, N'审批时间',   N'文本',   NULL, NULL, NULL, 0, 0, 0, 1, 130),
 (N'header',       265, N'文档编号',   N'文本',   NULL, NULL, NULL, 1, 0, 1, 1, 120),
 (N'header',       990, N'附件',       N'附件',   NULL, NULL, NULL, 0, 0, 1, 1, 160);

INSERT INTO yj_field (panel_code, col_name, label, label_en, data_type, dict_sql, ref_panel, ref_field,
                      display_field, place, seq, width, editable, required, hidden, visible)
SELECT N'QC_BHCP', f.col_name, f.col_name, dc.label_en, f.data_type, NULL, f.ref_panel, f.ref_field,
       f.display_field, f.place, f.seq, f.width, f.editable, f.required, f.hidden, f.visible
  FROM @f f
  LEFT JOIN (SELECT N'单据编号' AS c, N'Document Number' AS label_en UNION ALL SELECT N'单据日期', N'Document Date'
             UNION ALL SELECT N'客户名称', N'Customer Name'  UNION ALL SELECT N'产品编码', N'Product code'
             UNION ALL SELECT N'产品名称', N'Product Name'   UNION ALL SELECT N'备注', N'Remark'
             UNION ALL SELECT N'单据状态', N'Doc status'     UNION ALL SELECT N'审核人', N'Approved by'
             UNION ALL SELECT N'审核时间', N'Approved at'    UNION ALL SELECT N'工单号', N'Work Order No.'
             UNION ALL SELECT N'出货检验单号', N'Outgoing Inspection No.'
             UNION ALL SELECT N'工单行号', N'Work Order Line No.' UNION ALL SELECT N'批次号', N'Batch No.'
             UNION ALL SELECT N'不合格品数量', N'Nonconforming Qty' UNION ALL SELECT N'生产量', N'Production Qty'
            ) dc ON dc.c = f.col_name
 WHERE NOT EXISTS (SELECT 1 FROM yj_field x WHERE x.panel_code = N'QC_BHCP' AND x.col_name = f.col_name);

/* 制程单补登记 工单行号 / 批次号(表已加列) */
INSERT INTO yj_field (panel_code, col_name, label, label_en, data_type, dict_sql, ref_panel, ref_field,
                      display_field, place, seq, width, editable, required, hidden, visible)
SELECT N'QC_BHC', f.col_name, f.col_name, f.label_en, f.data_type, NULL, NULL, NULL, NULL,
       f.place, f.seq, f.width, f.editable, 0, 0, 1
  FROM (SELECT N'工单行号' AS col_name, N'Work Order Line No.' AS label_en, N'整数' AS data_type,
               N'header' AS place, 28 AS seq, 90 AS width, 0 AS editable
        UNION ALL
        SELECT N'批次号', N'Batch No.', N'文本', N'header', 29, 130, 1) f
 WHERE COL_LENGTH(N'dbo.qc_bhc', f.col_name) IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM yj_field x WHERE x.panel_code = N'QC_BHC' AND x.col_name = f.col_name);
GO

/* ═════════ E. 授权(照制程单的角色集与权限词逐角色复制) ═════════ */
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms)
SELECT r.role_id, N'QC_BHCP', r.can_approve, r.perms
  FROM yj_role_panel r
 WHERE r.panel_code = N'QC_BHC'
   AND NOT EXISTS (SELECT 1 FROM yj_role_panel x WHERE x.panel_code = N'QC_BHCP' AND x.role_id = r.role_id);
GO

/* ═════════ F. 多语言(面板名 10 语言;字段标签沿用全局既有译名,只补真正新增的) ═════════ */
DECLARE @t TABLE (scope varchar(20), ref_key nvarchar(120), locale varchar(10), text nvarchar(400));
INSERT INTO @t (scope, ref_key, locale, text) VALUES
 ('panel', N'不合格品处理单(成品)', 'en',    N'Nonconforming Product Disposition (Finished Goods)'),
 ('panel', N'不合格品处理单(成品)', 'zh-TW', N'不合格品處理單(成品)'),
 ('panel', N'不合格品处理单(成品)', 'ja',    N'不適合品処理票（完成品）'),
 ('panel', N'不合格品处理单(成品)', 'ko',    N'부적합품 처리서(완제품)'),
 ('panel', N'不合格品处理单(成品)', 'es',    N'Disposición de producto no conforme (producto terminado)'),
 ('panel', N'不合格品处理单(成品)', 'fr',    N'Traitement des produits non conformes (produit fini)'),
 ('panel', N'不合格品处理单(成品)', 'de',    N'Behandlung nicht konformer Produkte (Fertigprodukt)'),
 ('panel', N'不合格品处理单(成品)', 'ru',    N'Обработка несоответствующей продукции (готовая продукция)'),
 ('panel', N'不合格品处理单(成品)', 'vi',    N'Xử lý sản phẩm không phù hợp (thành phẩm)'),
 ('panel', N'不合格品处理单(成品)', 'th',    N'การจัดการผลิตภัณฑ์ที่ไม่เป็นไปตามข้อกำหนด (ผลิตภัณฑ์สำเร็จรูป)'),
 ('field', N'工单行号', 'en', N'Work Order Line No.'),
 ('field', N'出货检验单号', 'en', N'Outgoing Inspection No.');
INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT t.scope, t.ref_key, t.locale, t.text, 'manual'
  FROM @t t
 WHERE NOT EXISTS (SELECT 1 FROM yj_translation x
                    WHERE x.scope = t.scope AND x.ref_key = t.ref_key AND x.locale = t.locale);
GO

/* ═════════ G. 中文注明(表 + 关键列) ═════════ */
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.qc_bhc_cp') AND minor_id = 0 AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description',
        N'不合格品处理单(成品)头表——面板 QC_BHCP(2026-11-24);出货检验(表观)判不合格时自动建草稿,带出 出货检验单号/工单号/工单行号/批次号;不合格品数量参与产成品入库实收数量扣减',
        N'SCHEMA', N'dbo', N'TABLE', N'qc_bhc_cp';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.qc_bhc_cp_detail') AND minor_id = 0 AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description',
        N'不合格品处理单(成品)行表——面板 QC_BHCP 明细(纸面为单表式,行表只留审计四件套与备用列池)',
        N'SCHEMA', N'dbo', N'TABLE', N'qc_bhc_cp_detail';
GO

/* ═════════ H. 自检 ═════════ */
DECLARE @db sysname = DB_NAME();
DECLARE @t1 int = CASE WHEN OBJECT_ID(N'dbo.qc_bhc_cp', N'U') IS NOT NULL THEN 1 ELSE 0 END;
DECLARE @t2 int = CASE WHEN OBJECT_ID(N'dbo.qc_bhc_cp_detail', N'U') IS NOT NULL THEN 1 ELSE 0 END;
DECLARE @p int = (SELECT COUNT(*) FROM yj_panel WHERE panel_code = N'QC_BHCP' AND mode = N'doc' AND prefix = N'BHCP');
DECLARE @fc int = (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'QC_BHCP');
DECLARE @fr int = (SELECT COUNT(*) FROM yj_role_panel WHERE panel_code = N'QC_BHCP');
DECLARE @tr int = (SELECT COUNT(*) FROM yj_translation WHERE scope = 'panel' AND ref_key = N'不合格品处理单(成品)');
DECLARE @col int = (SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.qc_bhc') AND name IN (N'工单行号', N'批次号'));
IF @t1 = 1 AND @t2 = 1 AND @p = 1 AND @fc >= 41 AND @fr > 0 AND @tr >= 9 AND @col = 2
    RAISERROR(N'[PASS] %s 不合格品处理单(成品)已就绪(2 表 + 面板 + %d 字段 + %d 角色 + %d 译名 + 制程单 2 列)', 10, 1, @db, @fc, @fr, @tr);
ELSE
    RAISERROR(N'[FAIL] %s 自检未通过:表=%d/%d 面板=%d 字段=%d 角色=%d 译名=%d qc_bhc新列=%d', 16, 1,
              @db, @t1, @t2, @p, @fc, @fr, @tr, @col);
GO
