-- ════════════════════════════════════════════════════════════════════════════════════════
-- migrate-qc-fin-spec.sql — 「成品检验规范」统一文档面板(QC_FIN_SPEC)
--   2026-10-09 用户任务:「这些是所有和成品检验相关的文件,能否将这些整理为一个文档格式作为
--   成品检验文档的页面实现呢?先放在菜单拿出来,不要覆盖原有的组装成品检验单先。同时让当前的
--   生产工单完成后能自动生成这个,文件中的数据不重要,主要是格式实现。」
--   三项口径(用户未选,按推荐执行并已声明):①报工单审核时(现 woInspGenerate 钩子)自动生成
--   ②纸张式多页、照文档骨架 ③只要空格式(表头带 工单号/产品/批次,正文与检验项目空着由品质填)。
-- ════════════════════════════════════════════════════════════════════════════════════════
-- 【依据】8 份受控文件的结构归纳(原件转 docx 后逐份抽取骨架,证据 tools/archive/_qcspec/)：
--   YJ-Q-60 SMS / YJ-Q-62 载银抑菌料 A2 / 含锌粉 / YJ-Q-94 碱3料 / YJ-Q-89 碱4料 /
--   YJ-Q-130 钾长石 A0 / YJ-Q-129 方解石 A1 / YJ-Q-125 Y料 A0
--   共同骨架(逐份一致,仅编号 5/6 与子节数量不同)：
--     · 表1 文件修订履历：版本 | 修订理由与内容简述 | 修订日期 | 拟定
--     · 表2 签字栏：制 定 / 审 核 / 核 准 + 发行副本章
--     · 正文：1 目的 / 2 范围(适用范围) / 3 职责和权限 / 4 取样要求 / 5 工作程序
--     · 检验项目：若干**子节**，每节一个**检验对象**(原料(Y-CAS-23) / 成品(CAS-18) / 成品(XC-80120)…)，
--       节内表：检验项目 | 称料 | 接受标准 | 检验方法
--     · 检验结果处理方式：与检验项目一一对应的子节；不合格→退货/重新筛分/重新清洗；成品另配 合格→入库
--
-- 【模型】头表 qc_fin_spec_head = 抬头(文件编号/文件名称/版本版次/管控状态/发行日期)
--        + **工单联动字段**(工单号/报工单号/产品编码/产品名称/规格型号/批次号,自动生成时带入)
--        + 正文五段可填文本 + 签字栏；
--   行表 qc_fin_spec_detail 用 **表区** 分三块,加 **检验对象** 列区分子节：
--        表区='修订履历' → 版本/修订理由与内容简述/修订日期/拟定
--        表区='检验项目' → 检验对象 + 检验项目/称料/接受标准/检验方法   (一个检验对象=一个子节)
--        表区='处理方式' → 检验对象 + 合格处置/不合格处置            (与检验项目子节一一对应)
-- 【面板】QC_FIN_SPEC / 成品检验规范 / doc / 前缀 CPJY / 模块 品质管理；
--   纸张四页版式在前端 recordSheetConfigs.QC_FIN_SPEC(面板进 RECORD_SHEET_PANELS 即自动走纸张式渲染)。
-- 【不动现有单据】本脚本只新增；组装成品检验单(qc_asm_insp_head/_detail)与其它三张检验单**零改动**。
-- 【幂等】CREATE 走 OBJECT_ID 守卫;字段/译名/播种按 (panel,col)/(scope,ref_key,locale)/单号 判重。
-- 【两账套】先正式 HSDZ_MES,后 HSDZ_MES_TEST,均执行到 DbSync「执行 0、失败 0」。
-- ════════════════════════════════════════════════════════════════════════════════════════

/* ═══════════════════ A. 建表 ═══════════════════ */
IF OBJECT_ID('dbo.qc_fin_spec_head', 'U') IS NULL
CREATE TABLE dbo.qc_fin_spec_head (
  id           bigint IDENTITY(1,1) NOT NULL CONSTRAINT pk_qc_fin_spec_head PRIMARY KEY,
  单据编号     nvarchar(50)  NOT NULL,
  单据日期     date          NULL,
  文件编号     nvarchar(50)  NULL,
  文件名称     nvarchar(200) NULL,
  版本版次     nvarchar(20)  NULL,
  管控状态     nvarchar(20)  NULL,
  发行日期     date          NULL,
  工单号       nvarchar(50)  NULL,
  报工单号     nvarchar(50)  NULL,
  产品编码     nvarchar(50)  NULL,
  产品名称     nvarchar(200) NULL,
  规格型号     nvarchar(100) NULL,
  批次号       nvarchar(50)  NULL,
  目的         nvarchar(1000) NULL,
  范围         nvarchar(1000) NULL,
  职责和权限   nvarchar(2000) NULL,
  取样要求     nvarchar(1000) NULL,
  工作程序     nvarchar(2000) NULL,
  制定         nvarchar(50)  NULL,
  审核         nvarchar(50)  NULL,
  核准         nvarchar(50)  NULL,
  备注         nvarchar(500) NULL,
  审核人       nvarchar(50)  NULL,
  审核时间     datetime2     NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL,
  asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL,
  asp_cancel nvarchar(1) NULL CONSTRAINT df_qc_fin_spec_head_cancel DEFAULT (N'N'),
  单据状态   nvarchar(20) NULL
);
GO
IF OBJECT_ID('dbo.qc_fin_spec_detail', 'U') IS NULL
CREATE TABLE dbo.qc_fin_spec_detail (
  id           bigint IDENTITY(1,1) NOT NULL CONSTRAINT pk_qc_fin_spec_detail PRIMARY KEY,
  单据编号     nvarchar(50)  NOT NULL,
  行号         int           NULL,
  表区         nvarchar(50)  NULL,
  检验对象     nvarchar(100) NULL,
  版本         nvarchar(20)  NULL,
  修订理由与内容简述 nvarchar(500) NULL,
  修订日期     date          NULL,
  拟定         nvarchar(50)  NULL,
  检验项目     nvarchar(100) NULL,
  称料         nvarchar(50)  NULL,
  接受标准     nvarchar(500) NULL,
  检验方法     nvarchar(1000) NULL,
  合格处置     nvarchar(100) NULL,
  不合格处置   nvarchar(100) NULL,
  备注         nvarchar(200) NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL,
  asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL,
  asp_cancel nvarchar(1) NULL CONSTRAINT df_qc_fin_spec_detail_cancel DEFAULT (N'N')
);
GO
/* 中文注明(全量部署规范:新表与关键列必须带 MS_Description) */
DECLARE @t sysname, @c sysname, @cmt nvarchar(300);
DECLARE curC CURSOR LOCAL FAST_FORWARD FOR SELECT * FROM (VALUES
  (N'qc_fin_spec_head', NULL,            N'成品检验规范头表(8 份受控文件归纳的统一格式:修订履历+正文五段+检验项目分节+处理方式;报工审核自动生成草稿)'),
  (N'qc_fin_spec_head', N'文件编号',     N'受控文件编号(如 YJ-Q-125 / YJ-Q-60)'),
  (N'qc_fin_spec_head', N'文件名称',     N'受控文件名称(如 Y料原料及成品检验规范)'),
  (N'qc_fin_spec_head', N'版本版次',     N'版本/版次(如 A0/A1/A2;修订出新版=再开一张单)'),
  (N'qc_fin_spec_head', N'管控状态',     N'管控状态(受控/非受控)'),
  (N'qc_fin_spec_head', N'工单号',       N'关联生产工单(自动生成时带入;手工建档可留空)'),
  (N'qc_fin_spec_head', N'报工单号',     N'触发本规范的报工单号(幂等键:同一报工单只生成一张)'),
  (N'qc_fin_spec_head', N'取样要求',     N'取样要求(文档 §4,如 每50kg成品取样1个，每个样品200g)'),
  (N'qc_fin_spec_head', N'职责和权限',   N'职责和权限(文档 §3)'),
  (N'qc_fin_spec_detail', NULL,          N'成品检验规范行表(按 表区 分三块:修订履历/检验项目/处理方式;「检验对象」列区分子节)'),
  (N'qc_fin_spec_detail', N'表区',       N'表区(修订履历/检验项目/处理方式)'),
  (N'qc_fin_spec_detail', N'检验对象',   N'检验对象=子节名(如 原料(Y-CAS-23)/成品(CAS-18)/成品(XC-80120)),同一对象的行归为一节'),
  (N'qc_fin_spec_detail', N'称料',       N'称料量(文档「接受标准及方法」下的称料格,如 100g)'),
  (N'qc_fin_spec_detail', N'接受标准',   N'接受标准(如 +20目占比≤15%)'),
  (N'qc_fin_spec_detail', N'检验方法',   N'检验方法(文档「接受标准及方法」下的方法列)'),
  (N'qc_fin_spec_detail', N'合格处置',   N'合格处置(文档 §7,如 入库)'),
  (N'qc_fin_spec_detail', N'不合格处置', N'不合格处置(文档 §7,如 退货/重新筛分/重新清洗)')
) AS t(tb, c, cmt);
OPEN curC FETCH NEXT FROM curC INTO @t, @c, @cmt;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF @c IS NULL
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.' + @t) AND minor_id = 0 AND name = N'MS_Description')
      EXEC sp_addextendedproperty N'MS_Description', @cmt, N'SCHEMA', N'dbo', N'TABLE', @t;
  END
  ELSE IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID(N'dbo.' + @t)
                      AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.' + @t), @c, 'ColumnId') AND ep.name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', @cmt, N'SCHEMA', N'dbo', N'TABLE', @t, N'COLUMN', @c;
  FETCH NEXT FROM curC INTO @t, @c, @cmt;
END
CLOSE curC DEALLOCATE curC;
GO

/* ═══════════════════ B. 面板 + 字段 ═══════════════════ */
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = N'QC_FIN_SPEC')
  INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group)
  VALUES (N'QC_FIN_SPEC', N'成品检验规范', N'品质管理', N'doc', N'qc_fin_spec_detail', N'qc_fin_spec_head',
          N'单据编号', N'id', N'单据编号', N'CPJY', N'单据日期', 20, N'items', N'品质管理');
GO
DECLARE @fh TABLE (col nvarchar(50), place nvarchar(30), seq int, width int, editable int, required int);
INSERT INTO @fh VALUES
 (N'单据编号', N'query,header',  10, 130, 0, 1),
 (N'单据日期', N'query,header',  20, 110, 1, 1),
 (N'文件编号', N'query,header',  30, 120, 1, 0),
 (N'文件名称', N'query,header',  40, 280, 1, 0),
 (N'版本版次', N'query,header',  50, 90,  1, 0),
 (N'管控状态', N'header',        60, 90,  1, 0),
 (N'发行日期', N'header',        70, 110, 1, 0),
 (N'工单号',   N'query,header',  80, 140, 1, 0),
 (N'报工单号', N'header',        90, 140, 0, 0),
 (N'产品编码', N'query,header', 100, 120, 1, 0),
 (N'产品名称', N'header',       110, 200, 1, 0),
 (N'规格型号', N'header',       120, 140, 1, 0),
 (N'批次号',   N'query,header', 130, 110, 1, 0),
 (N'目的',     N'header',       140, 420, 1, 0),
 (N'范围',     N'header',       150, 420, 1, 0),
 (N'职责和权限', N'header',     160, 420, 1, 0),
 (N'取样要求', N'header',       170, 420, 1, 0),
 (N'工作程序', N'header',       180, 420, 1, 0),
 (N'制定',     N'header',       190, 100, 1, 0),
 (N'审核',     N'header',       200, 100, 1, 0),
 (N'核准',     N'header',       210, 100, 1, 0),
 (N'备注',     N'header,detail',220, 200, 1, 0),
 (N'单据状态', N'query,header', 230, 90,  0, 0),
 (N'审核人',   N'header',       240, 90,  0, 0),
 (N'审核时间', N'header',       250, 140, 0, 0);
DECLARE @c2 nvarchar(50), @p2 nvarchar(30), @s2 int, @w2 int, @e2 int, @r2 int;
DECLARE curF CURSOR LOCAL FAST_FORWARD FOR SELECT col, place, seq, width, editable, required FROM @fh;
OPEN curF FETCH NEXT FROM curF INTO @c2, @p2, @s2, @w2, @e2, @r2;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_FIN_SPEC' AND col_name = @c2)
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES (N'QC_FIN_SPEC', @c2, @c2, N'文本', @p2, @s2, @w2, @e2, @r2, 0, 1);
  FETCH NEXT FROM curF INTO @c2, @p2, @s2, @w2, @e2, @r2;
END
CLOSE curF DEALLOCATE curF;
DECLARE @fd TABLE (col nvarchar(50), seq int, width int);
INSERT INTO @fd VALUES
 (N'表区', 100, 90), (N'行号', 105, 60), (N'检验对象', 110, 150),
 (N'版本', 200, 70), (N'修订理由与内容简述', 210, 380), (N'修订日期', 220, 110), (N'拟定', 230, 90),
 (N'检验项目', 300, 140), (N'称料', 310, 90), (N'接受标准', 320, 260), (N'检验方法', 330, 360),
 (N'合格处置', 340, 100), (N'不合格处置', 350, 110);
DECLARE curD CURSOR LOCAL FAST_FORWARD FOR SELECT col, seq, width FROM @fd;
OPEN curD FETCH NEXT FROM curD INTO @c2, @s2, @w2;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_FIN_SPEC' AND col_name = @c2)
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES (N'QC_FIN_SPEC', @c2, @c2, N'文本', N'detail', @s2, @w2, 1, 0, 0, 1);
  FETCH NEXT FROM curD INTO @c2, @s2, @w2;
END
CLOSE curD DEALLOCATE curD;
GO
/* 译名(至少 en;同名字段已在别处有译名的按 (scope,ref_key) 判重跳过) */
DECLARE @ft TABLE (label nvarchar(50), en nvarchar(120));
INSERT INTO @ft VALUES
 (N'成品检验规范', N'Finished-goods Inspection Specification'), (N'文件编号', N'Document Code'),
 (N'版本版次', N'Version/Rev.'), (N'管控状态', N'Control Status'), (N'发行日期', N'Issue Date'),
 (N'工单号', N'Work Order No.'), (N'报工单号', N'Report No.'), (N'规格型号', N'Spec/Model'),
 (N'目的', N'Purpose'), (N'范围', N'Scope'), (N'职责和权限', N'Roles & Responsibilities'),
 (N'取样要求', N'Sample Requirement'), (N'工作程序', N'Procedure'), (N'制定', N'Prepared By'),
 (N'审核', N'Reviewed By'), (N'核准', N'Approved By'), (N'检验对象', N'Inspection Object'),
 (N'修订理由与内容简述', N'Revision Description'), (N'修订日期', N'Revision Date'), (N'拟定', N'Drafted By'),
 (N'称料', N'Weigh-out'), (N'接受标准', N'Acceptance Criteria'),
 (N'合格处置', N'Pass Disposition'), (N'不合格处置', N'Fail Disposition');
DECLARE @lb nvarchar(50), @en nvarchar(120);
DECLARE curt CURSOR LOCAL FAST_FORWARD FOR SELECT label, en FROM @ft;
OPEN curt FETCH NEXT FROM curt INTO @lb, @en;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'panel' AND ref_key = @lb AND locale = 'en')
     AND EXISTS (SELECT 1 FROM yj_panel WHERE panel_name = @lb)
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', @lb, 'en', @en, 'manual');
  IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = @lb AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', @lb, 'en', @en, 'manual');
  FETCH NEXT FROM curt INTO @lb, @en;
END
CLOSE curt DEALLOCATE curt;
GO

/* ═══════════════════ C. 播种 1 张示例(只做格式;数据取自 YJ-Q-125 的形状) ═══════════════════ */
DECLARE @doc nvarchar(50) = N'CPJY-2026-10-0001';
IF NOT EXISTS (SELECT 1 FROM qc_fin_spec_head WHERE 单据编号 = @doc)
BEGIN
  INSERT INTO qc_fin_spec_head (单据编号, 单据日期, 文件编号, 文件名称, 版本版次, 管控状态, 发行日期,
       目的, 范围, 职责和权限, 取样要求, 工作程序, 备注, 单据状态, asp_user1, asp_time1)
  VALUES (@doc, '2026-10-09', N'YJ-Q-125', N'Y料原料及成品检验规范', N'A0', N'受控', '2026-10-09',
       N'明确来料检验的工作方式、方法及控制流程，确保来料品质满足规范要求，并能有效根据流程实施控制。',
       N'适用于银嘉Y料原料及成品的质量检验工作。',
       N'本规范的实施者是品质部，品质部严格落实本规范，对实施过程及检验结果负责，并直接向总经理汇报。',
       N'4.1 每50kg原料取样1个，每个样品200g；4.2 每50kg成品取样1个，每个样品200g',
       N'原料仓库收货后即通知品质部进行来料检验，品质部根据本规范进行检验作业，并填写《来料检验报告》，如果检验合格，则通知仓管将来料入库，如果检验不合格，则填写《来料品质问题反馈单》，发给采购部，由采购部推动供应商解决问题。',
       N'格式示例(8 份受控文件归纳的统一骨架);正式使用请新建并填写本单位内容。', N'草稿', N'migration', SYSDATETIME());

  /* C1. 页1 修订履历 */
  INSERT INTO qc_fin_spec_detail (单据编号, 行号, 表区, 版本, 修订理由与内容简述, 修订日期, 拟定, asp_user1, asp_time1)
  VALUES (@doc, 1, N'修订履历', N'A0', N'首次发行', '2026-10-09', N'', N'migration', SYSDATETIME());

  /* C2. 页3 检验项目(两个检验对象=两个子节) */
  INSERT INTO qc_fin_spec_detail (单据编号, 行号, 表区, 检验对象, 检验项目, 称料, 接受标准, 检验方法, asp_user1, asp_time1)
  VALUES
   (@doc, 10, N'检验项目', N'原料（Y-CAS-23）', N'性能', N'40g', N'余氯去除率≥80%',
    N'1.称取40g 原料封装小T筒，进出水端用海绵压实；2.纯水加次氯酸钠加标；3.流速2L/min，冲2min取样测试余氯去除率。', N'migration', SYSDATETIME()),
   (@doc, 11, N'检验项目', N'原料（Y-CAS-23）', N'卫生安全', N'10g', N'镉≤0.0005mg/L；铅≤0.001mg/L；铬≤0.005mg/L',
    N'1.取10g来料，加入100ml浸泡液润洗两次，浸泡24h±1h，中速滤纸过滤；2.用icp-ms测试离子含量。', N'migration', SYSDATETIME()),
   (@doc, 20, N'检验项目', N'成品（CAS-18）', N'目数', N'100g', N'+20目≤15%；-325目≤10%',
    N'1.称取100g 成品，从上到下依次放20目、325目筛网震动筛分5min；2.称量计算各区间占比。', N'migration', SYSDATETIME());

  /* C3. 页4 检验结果处理方式(与检验项目子节一一对应) */
  INSERT INTO qc_fin_spec_detail (单据编号, 行号, 表区, 检验对象, 合格处置, 不合格处置, asp_user1, asp_time1)
  VALUES
   (@doc, 30, N'处理方式', N'原料（Y-CAS-23）', N'入库', N'退货', N'migration', SYSDATETIME()),
   (@doc, 31, N'处理方式', N'成品（CAS-18）',   N'入库', N'重新筛分', N'migration', SYSDATETIME());
END
GO

/* ═══════════════════ D. 自检 ═══════════════════ */
DECLARE @bad int = 0;
IF OBJECT_ID('dbo.qc_fin_spec_head') IS NULL OR OBJECT_ID('dbo.qc_fin_spec_detail') IS NULL SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = N'QC_FIN_SPEC') SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'QC_FIN_SPEC') < 38 SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_translation WHERE scope = 'field' AND locale = 'en' AND ref_key IN
      (N'文件编号', N'版本版次', N'工单号', N'检验对象', N'称料', N'接受标准', N'不合格处置')) < 7 SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM qc_fin_spec_head WHERE 单据编号 = N'CPJY-2026-10-0001') < 1 SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM qc_fin_spec_detail WHERE 单据编号 = N'CPJY-2026-10-0001' AND 表区 = N'修订履历') < 1 SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM qc_fin_spec_detail WHERE 单据编号 = N'CPJY-2026-10-0001' AND 表区 = N'检验项目') < 3 SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM qc_fin_spec_detail WHERE 单据编号 = N'CPJY-2026-10-0001' AND 表区 = N'处理方式') < 2 SET @bad = @bad + 1;
IF @bad > 0 RAISERROR(N'成品检验规范迁移自检失败(缺表/缺面板/缺字段/缺译名/缺播种)', 16, 1);
ELSE PRINT N'成品检验规范就绪:qc_fin_spec_head/_detail + 面板 QC_FIN_SPEC + 字段/译名;播种 CPJY-2026-10-0001(修订 1 / 检验项目 3 行 2 对象 / 处理方式 2 行)';
