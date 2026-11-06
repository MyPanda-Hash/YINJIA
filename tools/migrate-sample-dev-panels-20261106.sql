/* ============================================================================
   migrate-sample-dev-panels-20261106.sql
   研发管理 · 样品（二级目录）+ 两张开发样品申请单 —— 2026-11-06

   【需求来源·用户原话】
     「现在要加新面板，这个单独做一个二级目录：样品就在研发管理里面，流程与要求在文件里面了，
      就是按这个表格复刻样式，可以对其不合理的适当调整」
   设计依据：《新系统-样品流程和相关表格式.xlsx》
     sheet1「（外部）开发样品申请单」 —— 对外接客户样品需求（带费用/财务流程）
     sheet2「（内部）开发样品申请单-模板」 —— 内部立项后开发样品

   【为什么两张单分开建表】
     外部单有 客户名称/费用/下单日期/期望交期/产品功能/背景/性能要求/配方及工艺要求，
     内部单有 项目名/物料批次要求/样品状态，字段重合度只有 5 列（编号/炭棒尺寸/数量/交期/背景）。
     合并成一张表要 20+ 个「只对其中一种生效」的可空列，且审批链也不同
     （外部：申请→审核(刘磊)→确认(冯总)；内部：申请→确认(刘磊)），
     故独立成表 rd_sample_ext_head / rd_sample_int_head。

   【与旧 rd_sample_no_* 的关系】
     那是 2026-09-29 已下架的旧样品号池面板，**不复用、不改动**（在册台账里是例外保留项）。

   【表结构要点】
     · 两张单都是**单表无明细**（每张申请单就是一条样品需求），不需要 detail 表；
     · 外部单 sheet 里写「总表+子表：单个样品单下面可以添加多个样品」，但模板 sheet2 的
       「每有一个申请单就往下填充一行」说明实际是**一行一张单** ⇒ 按单表实现，
       多样品需求由用户分多张单提（避免为"子表"再造一层无人维护的从表）。
     · 样品编号规则：申请人姓名缩写 + 年月日 + 序号（前端自动生成，见 DocSheet）
     · 样品状态（内部单）：待确认/已确认/已安排/已完成，由确认人维护。

   ⚠ 两账套都要跑（先 HSDZ_MES 后 HSDZ_MES_TEST），已登记 tools/db-migrations.txt。
   ⚠ 幂等：建表 IF OBJECT_ID IS NULL、面板 IF NOT EXISTS、字段 NOT EXISTS。
   ============================================================================ */

SET NOCOUNT ON;
SET XACT_ABORT ON;
BEGIN TRAN;

/* ══════════════════════════════════════════════════════════════════════
   1) 外部开发样品申请单 · 头表 rd_sample_ext_head
   ══════════════════════════════════════════════════════════════════════ */
IF OBJECT_ID('rd_sample_ext_head') IS NULL
BEGIN
    CREATE TABLE rd_sample_ext_head (
        id                  int IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [单据编号]          nvarchar(50)  NULL,   /* 样品单编号：姓名缩写+年月日+序号 */
        [单据日期]          nvarchar(20)  NULL,   /* 下单日期 */
        /* ── 表头信息栏 ── */
        [客户名称]          nvarchar(100) NULL,
        [费用]              nvarchar(50)  NULL,
        [期望交期]          nvarchar(20)  NULL,
        /* ── 需求区（sheet A3:M4 六个区块）── */
        [产品整体规格]      nvarchar(500) NULL,
        [炭棒规格]          nvarchar(500) NULL,
        [样品数量]          nvarchar(50)  NULL,
        [组装要求]          nvarchar(500) NULL,
        [产品功能]          nvarchar(200) NULL,
        [背景]              nvarchar(500) NULL,
        [性能要求]          nvarchar(500) NULL,
        [配方及工艺要求]    nvarchar(500) NULL,
        /* ── 三级签署（sheet A7/J7）── */
        [申请]              nvarchar(200) NULL,   /* 申请人/日期 */
        [审核]              nvarchar(200) NULL,   /* 审核人(刘磊)/日期 */
        [确认]              nvarchar(200) NULL,   /* 确认人(冯总)/日期 */
        [备注]              nvarchar(500) NULL,
        asp_user1           nvarchar(50)  NULL,
        asp_time1           datetime2     NULL,
        asp_user2           nvarchar(50)  NULL,
        asp_time2           datetime2     NULL,
        asp_cancel          nvarchar(2)   NULL
    );
END
GO

/* ══════════════════════════════════════════════════════════════════════
   2) 内部开发样品申请单 · 头表 rd_sample_int_head
   ══════════════════════════════════════════════════════════════════════ */
IF OBJECT_ID('rd_sample_int_head') IS NULL
BEGIN
    CREATE TABLE rd_sample_int_head (
        id                  int IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [单据编号]          nvarchar(50)  NULL,   /* 样品编号：姓名缩写+年月日+序号 */
        [单据日期]          nvarchar(20)  NULL,   /* 申请日期 */
        [项目名]            nvarchar(200) NULL,
        [炭棒尺寸]          nvarchar(200) NULL,
        [数量]              nvarchar(50)  NULL,
        [样品背景]          nvarchar(500) NULL,
        [配方要求]          nvarchar(500) NULL,
        [工艺要求]          nvarchar(500) NULL,
        [物料批次要求]      nvarchar(500) NULL,
        [期望交期]          nvarchar(20)  NULL,
        [样品状态]          nvarchar(20)  NULL,   /* 待确认/已确认/已安排/已完成 */
        [确认人]            nvarchar(200) NULL,   /* 确认人/日期 */
        [备注]              nvarchar(500) NULL,
        asp_user1           nvarchar(50)  NULL,
        asp_time1           datetime2     NULL,
        asp_user2           nvarchar(50)  NULL,
        asp_time2           datetime2     NULL,
        asp_cancel          nvarchar(2)   NULL
    );
END
GO

/* ══════════════════════════════════════════════════════════════════════
   3) 表注明（规范要求：新增表必须带中文注明）
   ══════════════════════════════════════════════════════════════════════ */
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
                WHERE major_id=OBJECT_ID('rd_sample_ext_head') AND minor_id=0 AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description',
        N'（外部）开发样品申请单-头（研发管理·样品）。客户委托样品需求：客户名称/费用/期望交期+需求六区+三级签署。',
        'SCHEMA','dbo','TABLE','rd_sample_ext_head';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
                WHERE major_id=OBJECT_ID('rd_sample_int_head') AND minor_id=0 AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description',
        N'内部开发样品申请单-头（研发管理·样品）。内部立项后开发样品：项目名/炭棒尺寸/配方工艺要求/样品状态。',
        'SCHEMA','dbo','TABLE','rd_sample_int_head';
GO

/* ══════════════════════════════════════════════════════════════════════
   4) yj_panel 登记（module_group='研发管理'，两张单同属「样品」二级目录）
   ══════════════════════════════════════════════════════════════════════ */
-- 明细表：yj_panel.line_table 是 NOT NULL 列，且全库文书面板（RD_APPROVAL/RD_PROD_INFO/
-- RD_SPEC_DOC…）都成对建 detail 表。这两张单业务上没有子表，detail 只留骨架列
-- （单据编号 + 审计列），供引擎的通用明细通道走通；纸面不出明细区。
IF OBJECT_ID('rd_sample_ext_detail') IS NULL
    CREATE TABLE rd_sample_ext_detail (
        id          int IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [单据编号]  nvarchar(50) NOT NULL,
        asp_user1   nvarchar(50) NULL, asp_time1 datetime2 NULL,
        asp_user2   nvarchar(50) NULL, asp_time2 datetime2 NULL,
        asp_cancel  char(1) NULL DEFAULT 'N'
    );

IF OBJECT_ID('rd_sample_int_detail') IS NULL
    CREATE TABLE rd_sample_int_detail (
        id          int IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [单据编号]  nvarchar(50) NOT NULL,
        asp_user1   nvarchar(50) NULL, asp_time1 datetime2 NULL,
        asp_user2   nvarchar(50) NULL, asp_time2 datetime2 NULL,
        asp_cancel  char(1) NULL DEFAULT 'N'
    );
GO

IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'RD_SAMPLE_EXT')
    INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table,
                          group_col, pk_col, code_col, prefix, date_col, page_size,
                          detail_key, module_group)
    VALUES ('RD_SAMPLE_EXT', N'外部开发样品申请单', N'单据', 'doc', 'rd_sample_ext_detail', 'rd_sample_ext_head',
            N'单据编号', 'id', N'单据编号', 'SPW', N'单据日期', 20,
            'items', N'研发管理');

IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'RD_SAMPLE_INT')
    INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table,
                          group_col, pk_col, code_col, prefix, date_col, page_size,
                          detail_key, module_group)
    VALUES ('RD_SAMPLE_INT', N'内部开发样品申请单', N'单据', 'doc', 'rd_sample_int_detail', 'rd_sample_int_head',
            N'单据编号', 'id', N'单据编号', 'SPN', N'单据日期', 20,
            'items', N'研发管理');
GO

/* ══════════════════════════════════════════════════════════════════════
   5) yj_field · 外部单（sheet1 逐格对位）
   ══════════════════════════════════════════════════════════════════════ */
INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq,
                      editable, required, hidden, visible, dict_sql)
SELECT 'RD_SAMPLE_EXT', v.label, v.label, v.dtype, 'header', v.seq, v.ed, v.req, 0, 1, v.dict
FROM (VALUES
    (N'单据编号',         N'文本',    10,  0, 0, NULL),
    (N'单据日期',         N'日期',    20,  1, 0, NULL),
    (N'客户名称',         N'参照',    30,  1, 1, NULL),
    (N'费用',             N'文本',    40,  1, 0, NULL),
    (N'期望交期',         N'日期',    50,  1, 0, NULL),
    (N'产品整体规格',     N'文本',    60,  1, 0, NULL),
    (N'炭棒规格',         N'文本',    70,  1, 0, NULL),
    (N'样品数量',         N'文本',    80,  1, 1, NULL),
    (N'组装要求',         N'文本',    90,  1, 0, NULL),
    (N'产品功能',         N'文本',   100,  1, 0, NULL),
    (N'背景',             N'文本',   110,  1, 0, NULL),
    (N'性能要求',         N'文本',   120,  1, 0, NULL),
    (N'配方及工艺要求',   N'文本',   130,  1, 0, NULL),
    (N'申请',             N'文本',   140,  0, 0, NULL),
    (N'审核',             N'文本',   150,  0, 0, NULL),
    (N'确认',             N'文本',   160,  0, 0, NULL),
    (N'备注',             N'文本',   170,  1, 0, NULL)
) AS v(label, dtype, seq, ed, req, dict)
WHERE NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_SAMPLE_EXT' AND label=v.label);
GO

/* ══════════════════════════════════════════════════════════════════════
   6) yj_field · 内部单（sheet2 逐列对位）
   ══════════════════════════════════════════════════════════════════════ */
INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq,
                      editable, required, hidden, visible, dict_sql)
SELECT 'RD_SAMPLE_INT', v.label, v.label, v.dtype, 'header', v.seq, v.ed, v.req, 0, 1, v.dict
FROM (VALUES
    (N'单据编号',         N'文本',    10,  0, 0, NULL),
    (N'单据日期',         N'日期',    20,  1, 0, NULL),
    (N'项目名',           N'文本',    30,  1, 1, NULL),
    (N'炭棒尺寸',         N'文本',    40,  1, 1, NULL),
    (N'数量',             N'文本',    50,  1, 1, NULL),
    (N'样品背景',         N'文本',    60,  1, 0, NULL),
    (N'配方要求',         N'文本',    70,  1, 0, NULL),
    (N'工艺要求',         N'文本',    80,  1, 0, NULL),
    (N'物料批次要求',     N'文本',    90,  1, 0, NULL),
    (N'期望交期',         N'日期',   100,  1, 0, NULL),
    (N'样品状态',         N'下拉框', 110,  1, 0,
        N'SELECT v FROM (VALUES (N''待确认''),(N''已确认''),(N''已安排''),(N''已完成'')) AS t(v)'),
    (N'确认人',           N'文本',   120,  0, 0, NULL),
    (N'备注',             N'文本',   130,  1, 0, NULL)
) AS v(label, dtype, seq, ed, req, dict)
WHERE NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_SAMPLE_INT' AND label=v.label);
GO

/* ══════════════════════════════════════════════════════════════════════
   7) 客户名称挂参照 KHDA（同库既有口径：SALE_OUT/SO_ORDER/PROJ/QC_BHG 都指 KHDA.mc）
   ══════════════════════════════════════════════════════════════════════ */
UPDATE yj_field SET ref_panel = 'KHDA', ref_field = 'mc', display_field = 'mc'
 WHERE panel_code = 'RD_SAMPLE_EXT' AND label = N'客户名称';
IF @@ROWCOUNT > 3 RAISERROR(N'migrate-sample-dev-panels: 客户名称 UPDATE 命中行数异常', 16, 1);
GO

/* ══════════════════════════════════════════════════════════════════════
   8) 译名（多语言强制规范：新增面板 + 新增字段至少 en）
   ══════════════════════════════════════════════════════════════════════ */
INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT v.scope, v.k, v.loc, v.t, 'manual'
FROM (VALUES
    ('panel', N'外部开发样品申请单', 'en', N'External Dev Sample Request'),
    ('panel', N'内部开发样品申请单', 'en', N'Internal Dev Sample Request'),
    ('field', N'客户名称',   'en', N'Customer Name'),
    ('field', N'费用',       'en', N'Cost'),
    ('field', N'期望交期',   'en', N'Expected Delivery'),
    ('field', N'产品整体规格','en', N'Overall Spec'),
    ('field', N'炭棒规格',   'en', N'Rod Spec'),
    ('field', N'样品数量',   'en', N'Sample Qty'),
    ('field', N'组装要求',   'en', N'Assembly Req.'),
    ('field', N'产品功能',   'en', N'Product Function'),
    ('field', N'背景',       'en', N'Background'),
    ('field', N'性能要求',   'en', N'Performance Req.'),
    ('field', N'配方及工艺要求','en', N'Formula & Process Req.'),
    ('field', N'申请',       'en', N'Applied By'),
    ('field', N'审核',       'en', N'Reviewed By'),
    ('field', N'确认',       'en', N'Confirmed By'),
    ('field', N'项目名',     'en', N'Project Name'),
    ('field', N'炭棒尺寸',   'en', N'Rod Size'),
    ('field', N'数量',       'en', N'Qty'),
    ('field', N'样品背景',   'en', N'Sample Background'),
    ('field', N'配方要求',   'en', N'Formula Req.'),
    ('field', N'工艺要求',   'en', N'Process Req.'),
    ('field', N'物料批次要求','en', N'Material Batch Req.'),
    ('field', N'样品状态',   'en', N'Sample Status'),
    ('field', N'确认人',     'en', N'Confirmed By'),
    ('field', N'待确认',     'en', N'Pending Confirm'),
    ('field', N'已确认',     'en', N'Confirmed'),
    ('field', N'已安排',     'en', N'Scheduled'),
    ('field', N'已完成',     'en', N'Completed')
) AS v(scope, k, loc, t)
WHERE NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope=v.scope AND ref_key=v.k AND locale=v.loc);
GO

/* ══════════════════════════════════════════════════════════════════════
   9) 自检
   ══════════════════════════════════════════════════════════════════════ */
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='RD_SAMPLE_EXT')
    RAISERROR(N'migrate-sample-dev-panels: 自检失败 —— RD_SAMPLE_EXT 未登记', 16, 1);
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='RD_SAMPLE_INT')
    RAISERROR(N'migrate-sample-dev-panels: 自检失败 —— RD_SAMPLE_INT 未登记', 16, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_SAMPLE_EXT' AND label=N'客户名称' AND ref_panel='KHDA')
    RAISERROR(N'migrate-sample-dev-panels: 自检失败 —— 外部单客户名称未挂 KHDA 参照', 16, 1);
GO

COMMIT TRAN;
GO
