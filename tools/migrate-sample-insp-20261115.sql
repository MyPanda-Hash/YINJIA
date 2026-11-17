/* migrate-sample-insp-20261115.sql(2026-11-15):品质管理 → 样品检验(送样登记表 + 检验委托单)
 *
 * 需求来源(用户 2026-11-15 口径):
 *   「送样登记表和这个检验委托单都放在品质管理中,增加一列为样品检验。
 *     检验委托单为主要实际单据,需要这个单据完成形式实现为图片中的,可以在检验类别这里带入到
 *     送样登记表的内容,需要完成基础的审批流程。
 *     送样登记表作为一个检测目录和当前检验委托单的引用使用,作为一个查询目录,要求也要可以正常添加其他项。
 *     当前两张单据不需要和其他单据存在关系,两张表互联即可,不涉及项目内其他单据。」
 *
 * 唯一设计真源 = docs/design/检验委托单-首版.md(字段数据键/纸面版式/带入契约)。
 * 源文件:送样登记表-上系统的20261110.xls(内部检测目录 43 行)、
 *        水家电综合检测中心 检验委托单(委托检验合同).doc(YJ-QP-701-1-01 (00))。
 *
 * 本脚本做四件事:
 *   A. 建三张表:qc_sample_reg(检测目录,档案单表)/ qc_insp_commission_head / qc_insp_commission_detail;
 *   B. 登记两个面板:SAMPLE_REG(mode=archive)/ INSP_COMMISSION(mode=doc,前缀 WT);
 *   C. 登记字段:目录 10 个、委托单头 32 个、委托单行 10 个;并灌入目录种子 44 行;
 *   D. 角色授权 / en 译名 / 表与列中文注明;末尾自检(缺一即 RAISERROR 16)。
 *
 * 规范符合性(docs/development/数据库规范.md):
 *   前缀 qc_ = 品质管理单据(§1.1);主键 bigint IDENTITY + asp_user1/2 + asp_time1/2 + asp_cancel nvarchar(1)(§2.1/§2.2);
 *   文本一律 nvarchar、日期 datetime2、金额/数量 decimal(18,2)、不写业务状态固定默认值(§2.3);
 *   面板 mode ∈ {doc, archive};place 取值在收口集合内;新标签全部有 en 译名(AGENTS.md 多语言强制规范),
 *   新表与关键列全部写 MS_Description 中文注明(AGENTS.md 全量部署规范)。
 *   列名安全规范(§1.2):物理列名不含 . % / ( ) 与空格 ⇒ 带括号/斜杠的纸面文案只作 label
 *   (联系电话（手机）→ 联系电话手机;样品型号/规格 → 样品型号规格;收费（一个样/元）→ 收费)。
 *
 * 幂等:建表 IF OBJECT_ID IS NULL;索引 IF NOT EXISTS;面板/字段/授权/译名/注明全部 NOT EXISTS 守卫;
 *   种子逐行 WHERE NOT EXISTS(按「检测元素」判重)。两账套执行(先正式 HSDZ_MES、后测试 HSDZ_MES_TEST)。
 */

/* ============ A. 建表 ============ */
IF OBJECT_ID(N'dbo.qc_sample_reg', N'U') IS NULL
BEGIN
  /* 检测目录(送样登记表):一行 = 一个可检验项目。索引/方法/周期/收费/标准全部照源 xls。 */
  CREATE TABLE dbo.qc_sample_reg (
    id            bigint IDENTITY(1,1) NOT NULL CONSTRAINT pk_qc_sample_reg PRIMARY KEY,
    序号          int           NULL,        /* 目录行号(源 xls 1..43,外送部分 44) */
    检测元素      nvarchar(100) NULL,        /* 检测项目名:锂/钠/镁…/PH/TDS/硬度/COD/粒径等级 */
    内部检出限    nvarchar(50)  NULL,        /* 内部检出限(出报告需核对 5750.1,保留原文) */
    检测误差      nvarchar(50)  NULL,        /* 检测误差(源 xls 合并格:5%-10% / 10% / 2% …) */
    测试方法      nvarchar(100) NULL,        /* ICPMS/火焰法/哈希/气相/分光/PH计/滴定/激光 … */
    测试周期      nvarchar(50)  NULL,        /* 两天/一天/半天/周期7天 */
    收费          decimal(18,2) NULL,        /* 收费(一个样/元);面板 label=收费（一个样/元） */
    检测标准      nvarchar(500) NULL,        /* GB/T 5750.6-2023 / HJ700-2014 … */
    检测标准备注  nvarchar(500) NULL,        /* 方法名/外送说明 */
    备注          nvarchar(500) NULL,        /* 目录备注(如「外送部分」) */
    asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL,
    asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL,
    asp_cancel nvarchar(1) NULL CONSTRAINT df_qc_sample_reg_cancel DEFAULT (N'N')
  );
  PRINT N'[OK] qc_sample_reg(送样登记表·检测目录)已建';
END
ELSE PRINT N'[SKIP] qc_sample_reg 已存在';
GO

IF OBJECT_ID(N'dbo.qc_insp_commission_head', N'U') IS NULL
BEGIN
  /* 检验委托单头表(委托检验合同 YJ-QP-701-1-01):纸面 1~19 行的全部表头格。 */
  CREATE TABLE dbo.qc_insp_commission_head (
    id              bigint IDENTITY(1,1) NOT NULL CONSTRAINT pk_qc_insp_commission_head PRIMARY KEY,
    单据编号        nvarchar(50)   NOT NULL,   /* 号池前缀 WT:WT-2026-11-0001 */
    单据日期        date           NULL,       /* 纸面「年 月 日」 */
    委托单位        nvarchar(200)  NULL,
    委托单位地址    nvarchar(300)  NULL,
    制造商          nvarchar(200)  NULL,
    制造商地址      nvarchar(300)  NULL,
    生产厂          nvarchar(200)  NULL,
    生产厂地址      nvarchar(300)  NULL,
    联系人          nvarchar(50)   NULL,
    联系电话手机    nvarchar(50)   NULL,       /* 纸面 label「联系电话（手机）」 */
    邮箱            nvarchar(100)  NULL,       /* 纸面列头印 E-mail */
    样品名称        nvarchar(200)  NULL,
    商标            nvarchar(100)  NULL,
    样品数量        nvarchar(50)   NULL,       /* 允许「2L/3支」这类写法 ⇒ 文本 */
    样品型号规格    nvarchar(200)  NULL,       /* 纸面 label「样品型号/规格」 */
    检验类别        nvarchar(500)  NULL,       /* 由送样登记表带入的检验项目名摘要 */
    检验依据        nvarchar(1000) NULL,       /* 由带入项目的「检测标准」自动拼接,可手改 */
    检验项目及要求  nvarchar(1000) NULL,       /* 全项/部分项目(注明具体章节号) */
    样品处理方式    nvarchar(50)   NULL,       /* 单选:自行取走/自愿放弃/代办托运 */
    样品处理备注    nvarchar(500)  NULL,       /* 选「代办托运」时填收件人/电话/地址 */
    判定规则        nvarchar(50)   NULL,       /* 单选:按标准限值判定/其他判定规则/无需判定 */
    其他判定规则    nvarchar(500)  NULL,
    报告类型        nvarchar(50)   NULL,       /* 单选:普通报告/CNAS 报告 */
    检验报告有效期  nvarchar(50)   NULL,       /* 单选:长期有效/规定有效期 */
    有效期年数      decimal(18,2)  NULL,
    合计收费        decimal(18,2)  NULL,       /* 行表「收费」求和(纸面回写,只读) */
    备注            nvarchar(1000) NULL,
    委托单位确认    nvarchar(200)  NULL,       /* 纸面「委托单位确认、日期」格 */
    业务经办人确认  nvarchar(200)  NULL,       /* 纸面「业务经办人确认、日期」格 */
    审核人          nvarchar(50)   NULL,       /* 审批流落值(与 yj_doc_status.shr 同源) */
    审核时间        datetime2      NULL,
    单据状态        nvarchar(20)   NULL,       /* 草稿/审批中/已审核(引擎通用,不写固定默认值) */
    asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL,
    asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL,
    asp_cancel nvarchar(1) NULL CONSTRAINT df_qc_insp_commission_head_cancel DEFAULT (N'N')
  );
  PRINT N'[OK] qc_insp_commission_head(检验委托单头表)已建';
END
ELSE PRINT N'[SKIP] qc_insp_commission_head 已存在';
GO

IF OBJECT_ID(N'dbo.qc_insp_commission_detail', N'U') IS NULL
BEGIN
  /* 检验委托单行表:一行 = 从送样登记表带入的一个检验项目(快照,不建外键)。 */
  CREATE TABLE dbo.qc_insp_commission_detail (
    id            bigint IDENTITY(1,1) NOT NULL CONSTRAINT pk_qc_insp_commission_detail PRIMARY KEY,
    单据编号      nvarchar(50)  NOT NULL,      /* 关联头 qc_insp_commission_head.单据编号 */
    行号          int           NULL,          /* 纸面行序 1..n */
    检测元素      nvarchar(100) NULL,          /* 目录快照:检验项目名 */
    内部检出限    nvarchar(50)  NULL,          /* 目录快照 */
    检测误差      nvarchar(50)  NULL,          /* 目录快照 */
    测试方法      nvarchar(100) NULL,          /* 目录快照 */
    测试周期      nvarchar(50)  NULL,          /* 目录快照 */
    收费          decimal(18,2) NULL,          /* 目录快照;面板 label=收费（一个样/元） */
    检测标准      nvarchar(500) NULL,          /* 目录快照 */
    检测标准备注  nvarchar(500) NULL,          /* 目录快照 */
    备注          nvarchar(500) NULL,
    asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL,
    asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL,
    asp_cancel nvarchar(1) NULL CONSTRAINT df_qc_insp_commission_detail_cancel DEFAULT (N'N')
  );
  PRINT N'[OK] qc_insp_commission_detail(检验委托单行表)已建';
END
ELSE PRINT N'[SKIP] qc_insp_commission_detail 已存在';
GO

/* 索引(数据库规范 §1.3 命名;等值/排序高频:目录元素、单据编号) */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_qc_sample_reg_elem' AND object_id = OBJECT_ID(N'dbo.qc_sample_reg'))
  CREATE INDEX ix_qc_sample_reg_elem ON dbo.qc_sample_reg (检测元素);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_qc_insp_commission_head_no' AND object_id = OBJECT_ID(N'dbo.qc_insp_commission_head'))
  CREATE INDEX ix_qc_insp_commission_head_no ON dbo.qc_insp_commission_head (单据编号);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_qc_insp_commission_detail_no' AND object_id = OBJECT_ID(N'dbo.qc_insp_commission_detail'))
  CREATE INDEX ix_qc_insp_commission_detail_no ON dbo.qc_insp_commission_detail (单据编号);
GO

/* ============ B. 面板登记 ============ */
/* 送样登记表:archive(单单据档案)= 一张虚拟单承载整份检测目录,行可增删改、可查询/导出;
 * config 的唯一键声明与后端 ButtonService.saveArchive / 前端保存前查重同源。 */
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = N'SAMPLE_REG')
  INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group, config)
  VALUES (N'SAMPLE_REG', N'送样登记表', N'品质管理', 'archive',
          N'qc_sample_reg', NULL, NULL, N'id', N'检测元素', NULL, NULL, 100, N'items', N'品质管理',
          N'{"uniqueKeys":[["检测元素"]]}');
GO

/* 检验委托单:doc(头行式受控单据)+ 前缀 WT;detail_key=items 与纸面 head.detail.items 一致。 */
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = N'INSP_COMMISSION')
  INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group)
  VALUES (N'INSP_COMMISSION', N'检验委托单', N'品质管理', 'doc',
          N'qc_insp_commission_detail', N'qc_insp_commission_head',
          N'单据编号', N'id', N'单据编号', N'WT', N'单据日期', 20, N'items', N'品质管理');
GO

/* B2. 新建默认值(yj_panel.config.headDefaults):「新增」建单即带出纸面默认勾选,用户仍可改。
 *     - 样品处理方式 = 委托单位自行取走(纸面 ■1)
 *     - 判定规则     = 无需判定(纸面 ■)
 *     - 检验报告有效期 = 长期有效(纸面 ■)
 *     只补空列、不覆盖用户值(PanelRegistry.headDefaults + ButtonService.putHeadDefaults 同口径);
 *     单据日期由引擎按 date_col 自动写当天,故不在此声明。
 *     幂等:已有 headDefaults 的不覆盖(未来改默认值另开迁移)。 */
UPDATE yj_panel
   SET config = N'{"headDefaults":{"样品处理方式":"委托单位自行取走","判定规则":"无需判定","检验报告有效期":"长期有效"}}'
 WHERE panel_code = N'INSP_COMMISSION' AND (config IS NULL OR config NOT LIKE N'%headDefaults%');
GO

/* ============ C. 字段登记 ============ */
/* C1. 送样登记表(archive:全部 place=detail;检测元素/测试方法/检测标准 兼查询位) */
DECLARE @fd1 TABLE (col nvarchar(50), label nvarchar(60), place nvarchar(30), seq int, width int, editable int, required int, dtype nvarchar(20));
INSERT INTO @fd1 VALUES
 (N'序号',         N'序号',          N'detail',        10,  70, 1, 0, N'整数'),
 (N'检测元素',     N'检测元素',      N'query,detail',  20, 150, 1, 1, N'文本'),
 (N'内部检出限',   N'内部检出限',    N'detail',        30, 110, 1, 0, N'文本'),
 (N'检测误差',     N'检测误差',      N'detail',        40, 110, 1, 0, N'文本'),
 (N'测试方法',     N'测试方法',      N'query,detail',  50, 110, 1, 0, N'文本'),
 (N'测试周期',     N'测试周期',      N'detail',        60,  90, 1, 0, N'文本'),
 (N'收费',         N'收费（一个样/元）', N'detail',     70, 130, 1, 0, N'小数'),
 (N'检测标准',     N'检测标准',      N'query,detail',  80, 240, 1, 0, N'文本'),
 (N'检测标准备注', N'检测标准备注',  N'detail',        90, 240, 1, 0, N'文本'),
 (N'备注',         N'备注',          N'detail',       100, 180, 1, 0, N'文本');
DECLARE @c1 nvarchar(50), @l1 nvarchar(60), @p1 nvarchar(30), @s1 int, @w1 int, @e1 int, @r1 int, @d1 nvarchar(20);
DECLARE curf1 CURSOR LOCAL FAST_FORWARD FOR SELECT col, label, place, seq, width, editable, required, dtype FROM @fd1;
OPEN curf1 FETCH NEXT FROM curf1 INTO @c1, @l1, @p1, @s1, @w1, @e1, @r1, @d1;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SAMPLE_REG' AND col_name = @c1)
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES (N'SAMPLE_REG', @c1, @l1, @d1, @p1, @s1, @w1, @e1, @r1, 0, 1);
  FETCH NEXT FROM curf1 INTO @c1, @l1, @p1, @s1, @w1, @e1, @r1, @d1;
END
CLOSE curf1 DEALLOCATE curf1;
GO

/* C2. 检验委托单·表头(32 个:query,header 用于列表查询条件;header 只进纸面/表单) */
DECLARE @fh TABLE (col nvarchar(50), label nvarchar(60), place nvarchar(30), seq int, width int, editable int, required int, dtype nvarchar(20));
INSERT INTO @fh VALUES
 (N'单据编号',       N'单据编号',         N'query,header',  10, 140, 0, 1, N'文本'),
 (N'单据日期',       N'单据日期',         N'query,header',  20, 110, 1, 1, N'日期'),
 (N'委托单位',       N'委托单位',         N'query,header',  30, 200, 1, 0, N'文本'),
 (N'委托单位地址',   N'委托单位地址',     N'header',        40, 240, 1, 0, N'文本'),
 (N'制造商',         N'制造商',           N'header',        50, 180, 1, 0, N'文本'),
 (N'制造商地址',     N'制造商地址',       N'header',        60, 240, 1, 0, N'文本'),
 (N'生产厂',         N'生产厂',           N'header',        70, 180, 1, 0, N'文本'),
 (N'生产厂地址',     N'生产厂地址',       N'header',        80, 240, 1, 0, N'文本'),
 (N'联系人',         N'联系人',           N'header',        90,  90, 1, 0, N'文本'),
 (N'联系电话手机',   N'联系电话（手机）', N'header',       100, 130, 1, 0, N'文本'),
 (N'邮箱',           N'邮箱',             N'header',       110, 150, 1, 0, N'文本'),
 (N'样品名称',       N'样品名称',         N'query,header', 120, 180, 1, 0, N'文本'),
 (N'商标',           N'商标',             N'header',       130, 100, 1, 0, N'文本'),
 (N'样品数量',       N'样品数量',         N'header',       140,  90, 1, 0, N'文本'),
 (N'样品型号规格',   N'样品型号/规格',    N'header',       150, 180, 1, 0, N'文本'),
 (N'检验类别',       N'检验类别',         N'query,header', 160, 260, 1, 0, N'文本'),
 (N'检验依据',       N'检验依据',         N'header',       170, 300, 1, 0, N'文本'),
 (N'检验项目及要求', N'检验项目及要求',   N'header',       180, 300, 1, 0, N'多行文本'),
 (N'样品处理方式',   N'样品处理方式',     N'header',       190, 200, 1, 0, N'文本'),
 (N'样品处理备注',   N'样品处理备注',     N'header',       200, 260, 1, 0, N'文本'),
 (N'判定规则',       N'判定规则',         N'header',       210, 140, 1, 0, N'文本'),
 (N'其他判定规则',   N'其他判定规则',     N'header',       220, 200, 1, 0, N'文本'),
 (N'报告类型',       N'报告类型',         N'header',       230, 120, 1, 0, N'文本'),
 (N'检验报告有效期', N'检验报告有效期',   N'header',       240, 140, 1, 0, N'文本'),
 (N'有效期年数',     N'有效期年数',       N'header',       250, 100, 1, 0, N'小数'),
 (N'合计收费',       N'合计收费',         N'header',       260, 100, 0, 0, N'小数'),
 (N'备注',           N'备注',             N'header',       270, 260, 1, 0, N'多行文本'),
 (N'委托单位确认',   N'委托单位确认',     N'header',       280, 160, 1, 0, N'文本'),
 (N'业务经办人确认', N'业务经办人确认',   N'header',       290, 160, 1, 0, N'文本'),
 (N'审核人',         N'审核人',           N'header',       300,  90, 0, 0, N'文本'),
 (N'审核时间',       N'审核时间',         N'header',       310, 140, 0, 0, N'文本'),
 (N'单据状态',       N'单据状态',         N'query,header', 900,  90, 0, 0, N'文本');
DECLARE @c2 nvarchar(50), @l2 nvarchar(60), @p2 nvarchar(30), @s2 int, @w2 int, @e2 int, @r2 int, @d2 nvarchar(20);
DECLARE curf2 CURSOR LOCAL FAST_FORWARD FOR SELECT col, label, place, seq, width, editable, required, dtype FROM @fh;
OPEN curf2 FETCH NEXT FROM curf2 INTO @c2, @l2, @p2, @s2, @w2, @e2, @r2, @d2;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'INSP_COMMISSION' AND col_name = @c2)
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES (N'INSP_COMMISSION', @c2, @l2, @d2, @p2, @s2, @w2, @e2, @r2, 0, 1);
  FETCH NEXT FROM curf2 INTO @c2, @l2, @p2, @s2, @w2, @e2, @r2, @d2;
END
CLOSE curf2 DEALLOCATE curf2;
GO

/* C3. 检验委托单·行表(10 个:一行 = 从送样登记表带入的一个检验项目) */
DECLARE @fd2 TABLE (col nvarchar(50), label nvarchar(60), seq int, width int, editable int, required int, hidden int, dtype nvarchar(20));
INSERT INTO @fd2 VALUES
 (N'行号',         N'行号',          10,  60, 0, 0, 1, N'整数'),
 (N'检测元素',     N'检测元素',      20, 130, 1, 0, 0, N'文本'),
 (N'内部检出限',   N'内部检出限',    30, 110, 1, 0, 0, N'文本'),
 (N'检测误差',     N'检测误差',      40, 100, 1, 0, 0, N'文本'),
 (N'测试方法',     N'测试方法',      50, 110, 1, 0, 0, N'文本'),
 (N'测试周期',     N'测试周期',      60,  90, 1, 0, 0, N'文本'),
 (N'收费',         N'收费（一个样/元）', 70, 130, 1, 0, 0, N'小数'),
 (N'检测标准',     N'检测标准',      80, 220, 1, 0, 0, N'文本'),
 (N'检测标准备注', N'检测标准备注',  90, 220, 1, 0, 0, N'文本');
DECLARE @c3 nvarchar(50), @l3 nvarchar(60), @s3 int, @w3 int, @e3 int, @r3 int, @h3 int, @d3 nvarchar(20);
DECLARE curf3 CURSOR LOCAL FAST_FORWARD FOR SELECT col, label, seq, width, editable, required, hidden, dtype FROM @fd2;
OPEN curf3 FETCH NEXT FROM curf3 INTO @c3, @l3, @s3, @w3, @e3, @r3, @h3, @d3;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'INSP_COMMISSION' AND col_name = @c3 AND place = N'detail')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES (N'INSP_COMMISSION', @c3, @l3, @d3, N'detail', @s3, @w3, @e3, @r3, @h3, CASE WHEN @h3 = 1 THEN 0 ELSE 1 END);
  FETCH NEXT FROM curf3 INTO @c3, @l3, @s3, @w3, @e3, @r3, @h3, @d3;
END
CLOSE curf3 DEALLOCATE curf3;
GO

/* C3-修订:行表「备注」与表头「备注」同面板同名 ⇒ 数据键不唯一(DbNormAudit 08 同一列多标签),
 * 行表备注字段取消登记(物理列 qc_insp_commission_detail.备注 保留,零数据)。已建账套删掉这条登记行。 */
DELETE FROM yj_field WHERE panel_code = N'INSP_COMMISSION' AND col_name = N'备注' AND place = N'detail';
GO

/* ---------- C. 种子数据:内部检测目录 44 行(源 xls 43 行 + 「外送部分」) ----------
 * 幂等:逐行 WHERE NOT EXISTS(按「检测元素」判重);插入顺序 = 序号倒序,
 * archive 面板查询 ORDER BY id DESC ⇒ 界面按 序号 1..44 升序展示,新增项自然排在最前。
 */
INSERT INTO dbo.qc_sample_reg (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1)
SELECT 44, N'外送部分', N'', N'', N'', N'', NULL, N'', N'据实需求际联系机构进行报价等信息', N'不能测的：外送部分据实需求际联系机构进行报价等信息', N'system', SYSDATETIME()
WHERE NOT EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'外送部分');
INSERT INTO dbo.qc_sample_reg (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1)
SELECT 43, N'三级精度', N'5um', N'2%', N'激光', N'半天', 100, N'NSF42', N'', N'', N'system', SYSDATETIME()
WHERE NOT EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'三级精度');
INSERT INTO dbo.qc_sample_reg (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1)
SELECT 42, N'二级精度', N'1um', N'2%', N'激光', N'半天', 100, N'NSF42', N'', N'', N'system', SYSDATETIME()
WHERE NOT EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'二级精度');
INSERT INTO dbo.qc_sample_reg (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1)
SELECT 41, N'一级精度', N'0.5um', N'2%', N'激光', N'半天', 100, N'NSF42', N'', N'', N'system', SYSDATETIME()
WHERE NOT EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'一级精度');
INSERT INTO dbo.qc_sample_reg (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1)
SELECT 40, N'粒度', N'0.02um', N'2%', N'激光', N'半天', 100, N'5750-2023', N'生活饮用水标准检验方法', N'', N'system', SYSDATETIME()
WHERE NOT EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'粒度');
INSERT INTO dbo.qc_sample_reg (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1)
SELECT 39, N'氯胺', N'0.02ppm', N'5%', N'分光', N'半天', 100, N'5750-2023', N'生活饮用水标准检验方法', N'', N'system', SYSDATETIME()
WHERE NOT EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'氯胺');
INSERT INTO dbo.qc_sample_reg (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1)
SELECT 38, N'余氯', N'0.02ppm', N'2%', N'显色', N'半天', 200, N'5750-2023', N'生活饮用水标准检验方法', N'', N'system', SYSDATETIME()
WHERE NOT EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'余氯');
INSERT INTO dbo.qc_sample_reg (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1)
SELECT 37, N'COD', N'0.25ppm', N'5%', N'滴定', N'半天', 200, N'5750-2023', N'生活饮用水标准检验方法', N'', N'system', SYSDATETIME()
WHERE NOT EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'COD');
INSERT INTO dbo.qc_sample_reg (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1)
SELECT 36, N'碱度', N'10ppm', N'5%', N'滴定', N'半天', 200, N'5750-2023', N'生活饮用水标准检验方法', N'', N'system', SYSDATETIME()
WHERE NOT EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'碱度');
INSERT INTO dbo.qc_sample_reg (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1)
SELECT 35, N'硬度', N'10ppm', N'5%', N'滴定', N'半天', 200, N'5750-2023', N'生活饮用水标准检验方法', N'', N'system', SYSDATETIME()
WHERE NOT EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'硬度');
INSERT INTO dbo.qc_sample_reg (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1)
SELECT 34, N'浊度', N'0.5ntu', N'2%', N'浊度笔', N'半天', 50, N'5750-2023', N'生活饮用水标准检验方法', N'', N'system', SYSDATETIME()
WHERE NOT EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'浊度');
INSERT INTO dbo.qc_sample_reg (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1)
SELECT 33, N'TDS', N'0.1', N'2%', N'TDS笔', N'半天', 50, N'5750-2023', N'生活饮用水标准检验方法', N'', N'system', SYSDATETIME()
WHERE NOT EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'TDS');
INSERT INTO dbo.qc_sample_reg (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1)
SELECT 32, N'PH', N'1', N'2%', N'PH计', N'半天', 50, N'5750-2023', N'生活饮用水标准检验方法', N'', N'system', SYSDATETIME()
WHERE NOT EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'PH');
INSERT INTO dbo.qc_sample_reg (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1)
SELECT 31, N'总磷', N'0.01ppm', N'5%', N'分光', N'半天', 200, N'GB/T 11893- 1989', N'水质 总磷的测定 钼酸铵分光光度法', N'', N'system', SYSDATETIME()
WHERE NOT EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'总磷');
INSERT INTO dbo.qc_sample_reg (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1)
SELECT 30, N'三氯甲烷', N'0.005ppm', N'5%', N'气相', N'一天', 300, N'SL 393-2007', N'吹扫描捕集气象质谱/质谱分析法（GC/MS）', N'', N'system', SYSDATETIME()
WHERE NOT EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'三氯甲烷');
INSERT INTO dbo.qc_sample_reg (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1)
SELECT 29, N'氟化物', N'0.05ppm', N'2%', N'哈希', N'半天', 100, N'GB 7484-87', N'水质 氟化物的测定', N'', N'system', SYSDATETIME()
WHERE NOT EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'氟化物');
INSERT INTO dbo.qc_sample_reg (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1)
SELECT 28, N'汞', N'0.0001ppm', N'5%', N'ICPMS', N'周期7天', 100, N'GB/T 5750.6-2023', N'外送测试，周期7天', N'', N'system', SYSDATETIME()
WHERE NOT EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'汞');
INSERT INTO dbo.qc_sample_reg (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1)
SELECT 27, N'高浓度铅', N'1ppm', N'10%', N'火焰法', N'一天', 100, N'', N'生活饮用水标准检验方法 水质 65 种元素的测定', N'', N'system', SYSDATETIME()
WHERE NOT EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'高浓度铅');
INSERT INTO dbo.qc_sample_reg (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1)
SELECT 26, N'高浓度锌', N'1ppm', N'10%', N'火焰法', N'一天', 100, N'GB/T 5750.6-2023 / HJ700-2014', N'生活饮用水标准检验方法 水质 65 种元素的测定', N'', N'system', SYSDATETIME()
WHERE NOT EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'高浓度锌');
INSERT INTO dbo.qc_sample_reg (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1)
SELECT 25, N'高浓度镁', N'1ppm', N'10%', N'火焰法', N'一天', 100, N'GB/T 5750.6-2023 / HJ700-2014', N'生活饮用水标准检验方法 水质 65 种元素的测定', N'', N'system', SYSDATETIME()
WHERE NOT EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'高浓度镁');
INSERT INTO dbo.qc_sample_reg (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1)
SELECT 24, N'高浓度钙', N'1ppm', N'10%', N'火焰法', N'一天', 100, N'GB/T 5750.6-2023 / HJ700-2014', N'生活饮用水标准检验方法 水质 65 种元素的测定', N'', N'system', SYSDATETIME()
WHERE NOT EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'高浓度钙');
INSERT INTO dbo.qc_sample_reg (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1)
SELECT 23, N'钡', N'0.001ppm', N'5%-10%', N'ICPMS', N'两天', 100, N'GB/T 5750.6-2023 / HJ700-2014', N'生活饮用水标准检验方法 水质 65 种元素的测定', N'', N'system', SYSDATETIME()
WHERE NOT EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'钡');
INSERT INTO dbo.qc_sample_reg (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1)
SELECT 22, N'锡', N'0.001ppm', N'5%-10%', N'ICPMS', N'两天', 100, N'GB/T 5750.6-2023 / HJ700-2014', N'生活饮用水标准检验方法 水质 65 种元素的测定', N'', N'system', SYSDATETIME()
WHERE NOT EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'锡');
INSERT INTO dbo.qc_sample_reg (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1)
SELECT 21, N'锑', N'0.0005ppm', N'5%-10%', N'ICPMS', N'两天', 100, N'GB/T 5750.6-2023 / HJ700-2014', N'生活饮用水标准检验方法 水质 65 种元素的测定', N'', N'system', SYSDATETIME()
WHERE NOT EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'锑');
INSERT INTO dbo.qc_sample_reg (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1)
SELECT 20, N'铅', N'0.001ppm', N'5%-10%', N'ICPMS', N'两天', 100, N'GB/T 5750.6-2023 / HJ700-2014', N'生活饮用水标准检验方法 水质 65 种元素的测定', N'', N'system', SYSDATETIME()
WHERE NOT EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'铅');
INSERT INTO dbo.qc_sample_reg (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1)
SELECT 19, N'镉', N'0.0001ppm', N'5%-10%', N'ICPMS', N'两天', 100, N'GB/T 5750.6-2023 / HJ700-2014', N'生活饮用水标准检验方法 水质 65 种元素的测定', N'', N'system', SYSDATETIME()
WHERE NOT EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'镉');
INSERT INTO dbo.qc_sample_reg (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1)
SELECT 18, N'银', N'0.0001ppm', N'5%-10%', N'ICPMS', N'两天', 100, N'GB/T 5750.6-2023 / HJ700-2014', N'生活饮用水标准检验方法 水质 65 种元素的测定', N'', N'system', SYSDATETIME()
WHERE NOT EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'银');
INSERT INTO dbo.qc_sample_reg (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1)
SELECT 17, N'锶', N'0.100ppm', N'5%-10%', N'ICPMS', N'两天', 100, N'GB/T 5750.6-2023 / HJ700-2014', N'生活饮用水标准检验方法 水质 65 种元素的测定', N'', N'system', SYSDATETIME()
WHERE NOT EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'锶');
INSERT INTO dbo.qc_sample_reg (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1)
SELECT 16, N'硒', N'0.001ppm', N'5%-10%', N'ICPMS', N'两天', 100, N'GB/T 5750.6-2023 / HJ700-2014', N'生活饮用水标准检验方法 水质 65 种元素的测定', N'', N'system', SYSDATETIME()
WHERE NOT EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'硒');
INSERT INTO dbo.qc_sample_reg (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1)
SELECT 15, N'砷', N'0.0001ppm', N'5%-10%', N'ICPMS', N'两天', 100, N'GB/T 5750.6-2023 / HJ700-2014', N'生活饮用水标准检验方法 水质 65 种元素的测定', N'', N'system', SYSDATETIME()
WHERE NOT EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'砷');
INSERT INTO dbo.qc_sample_reg (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1)
SELECT 14, N'锌', N'0.001ppm', N'5%-10%', N'ICPMS', N'两天', 100, N'GB/T 5750.6-2023 / HJ700-2014', N'生活饮用水标准检验方法 水质 65 种元素的测定', N'', N'system', SYSDATETIME()
WHERE NOT EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'锌');
INSERT INTO dbo.qc_sample_reg (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1)
SELECT 13, N'铜', N'0.001ppm', N'5%-10%', N'ICPMS', N'两天', 100, N'GB/T 5750.6-2023 / HJ700-2014', N'生活饮用水标准检验方法 水质 65 种元素的测定', N'', N'system', SYSDATETIME()
WHERE NOT EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'铜');
INSERT INTO dbo.qc_sample_reg (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1)
SELECT 12, N'镍', N'0.001ppm', N'5%-10%', N'ICPMS', N'两天', 100, N'GB/T 5750.6-2023 / HJ700-2014', N'生活饮用水标准检验方法 水质 65 种元素的测定', N'', N'system', SYSDATETIME()
WHERE NOT EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'镍');
INSERT INTO dbo.qc_sample_reg (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1)
SELECT 11, N'铁', N'0.001ppm', N'5%-10%', N'ICPMS', N'两天', 100, N'GB/T 5750.6-2023 / HJ700-2014', N'生活饮用水标准检验方法 水质 65 种元素的测定', N'', N'system', SYSDATETIME()
WHERE NOT EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'铁');
INSERT INTO dbo.qc_sample_reg (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1)
SELECT 10, N'锰', N'0.001ppm', N'5%-10%', N'ICPMS', N'两天', 100, N'GB/T 5750.6-2023 / HJ700-2014', N'生活饮用水标准检验方法 水质 65 种元素的测定', N'', N'system', SYSDATETIME()
WHERE NOT EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'锰');
INSERT INTO dbo.qc_sample_reg (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1)
SELECT 9, N'铬', N'0.001ppm', N'5%-10%', N'ICPMS', N'两天', 100, N'GB/T 5750.6-2023 / HJ700-2014', N'生活饮用水标准检验方法 水质 65 种元素的测定', N'', N'system', SYSDATETIME()
WHERE NOT EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'铬');
INSERT INTO dbo.qc_sample_reg (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1)
SELECT 8, N'钒', N'0.001ppm', N'5%-10%', N'ICPMS', N'两天', 100, N'GB/T 5750.6-2023 / HJ700-2014', N'生活饮用水标准检验方法 水质 65 种元素的测定', N'', N'system', SYSDATETIME()
WHERE NOT EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'钒');
INSERT INTO dbo.qc_sample_reg (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1)
SELECT 7, N'钙', N'0.100ppm', N'5%-10%', N'ICPMS', N'两天', 100, N'GB/T 5750.6-2023 / HJ700-2014', N'生活饮用水标准检验方法 水质 65 种元素的测定', N'', N'system', SYSDATETIME()
WHERE NOT EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'钙');
INSERT INTO dbo.qc_sample_reg (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1)
SELECT 6, N'钾', N'0.100ppm', N'5%-10%', N'ICPMS', N'两天', 100, N'GB/T 5750.6-2023 / HJ700-2014', N'生活饮用水标准检验方法 水质 65 种元素的测定', N'', N'system', SYSDATETIME()
WHERE NOT EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'钾');
INSERT INTO dbo.qc_sample_reg (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1)
SELECT 5, N'磷', N'0.001ppm', N'5%-10%', N'ICPMS', N'两天', 100, N'GB/T 5750.6-2023 / HJ700-2014', N'生活饮用水标准检验方法 水质 65 种元素的测定', N'', N'system', SYSDATETIME()
WHERE NOT EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'磷');
INSERT INTO dbo.qc_sample_reg (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1)
SELECT 4, N'铝', N'0.001ppm', N'5%-10%', N'ICPMS', N'两天', 100, N'GB/T 5750.6-2023 / HJ700-2014', N'生活饮用水标准检验方法 水质 65 种元素的测定', N'', N'system', SYSDATETIME()
WHERE NOT EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'铝');
INSERT INTO dbo.qc_sample_reg (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1)
SELECT 3, N'镁', N'0.100ppm', N'5%-10%', N'ICPMS', N'两天', 100, N'GB/T 5750.6-2023 / HJ700-2014', N'生活饮用水标准检验方法 水质 65 种元素的测定', N'', N'system', SYSDATETIME()
WHERE NOT EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'镁');
INSERT INTO dbo.qc_sample_reg (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1)
SELECT 2, N'钠', N'0.100ppm', N'5%-10%', N'ICPMS', N'两天', 100, N'GB/T 5750.6-2023 / HJ700-2014', N'生活饮用水标准检验方法 水质 65 种元素的测定', N'', N'system', SYSDATETIME()
WHERE NOT EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'钠');
INSERT INTO dbo.qc_sample_reg (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1)
SELECT 1, N'锂', N'0.001ppm', N'5%-10%', N'ICPMS', N'两天', 100, N'GB/T 5750.6-2023 / HJ700-2014', N'生活饮用水标准检验方法 水质 65 种元素的测定', N'', N'system', SYSDATETIME()
WHERE NOT EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'锂');
GO
/* ============ E. 角色授权 ============
 * 口径照抄「来料检验单 QC_INSP」(品质检验链同一批人):能看见/操作来料检验单的角色,
 * 就能看见送样登记表与检验委托单;审批权(can_approve)同样照 QC_INSP 下放
 * (管理员另有 is_admin 旁路,不受 can_approve 限制)。
 * ⚠ 漏这段 = 菜单能进、点进去被路由守卫踢回登录页(2026-11-14 巡线检验踩过)。
 */
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms)
SELECT r.id, N'SAMPLE_REG', N'N',
       ISNULL(NULLIF(i.perms, N''), N'view,query,add,modify,modlog,del,export')
FROM yj_role r
LEFT JOIN yj_role_panel i ON i.role_id = r.id AND i.panel_code = N'QC_INSP'
WHERE NOT EXISTS (SELECT 1 FROM yj_role_panel rp WHERE rp.role_id = r.id AND rp.panel_code = N'SAMPLE_REG');
GO
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms)
SELECT r.id, N'INSP_COMMISSION', ISNULL(i.can_approve, N'N'),
       ISNULL(NULLIF(i.perms, N''), N'view,query,add,modify,modlog,del,export')
FROM yj_role r
LEFT JOIN yj_role_panel i ON i.role_id = r.id AND i.panel_code = N'QC_INSP'
WHERE NOT EXISTS (SELECT 1 FROM yj_role_panel rp WHERE rp.role_id = r.id AND rp.panel_code = N'INSP_COMMISSION');
GO

/* ============ F. 多语言(AGENTS.md 强制:面板名 + 每个新标签 en;已有全局译名的 NOT EXISTS 跳过) ============ */
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'panel' AND ref_key = N'送样登记表' AND locale = N'en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source)
  VALUES (N'panel', N'送样登记表', N'en', N'Sample Submission Register', N'manual');
GO
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'panel' AND ref_key = N'检验委托单' AND locale = N'en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source)
  VALUES (N'panel', N'检验委托单', N'en', N'Inspection Commission Order', N'manual');
GO

DECLARE @ft TABLE (label nvarchar(60), en nvarchar(160));
INSERT INTO @ft VALUES
 (N'序号',              N'No.'),
 (N'检测元素',          N'Test Element'),
 (N'内部检出限',        N'Internal Detection Limit'),
 (N'检测误差',          N'Detection Error'),
 (N'测试方法',          N'Test Method'),
 (N'测试周期',          N'Test Cycle'),
 (N'收费（一个样/元）', N'Fee (per Sample/CNY)'),
 (N'检测标准',          N'Test Standard'),
 (N'检测标准备注',      N'Standard Remark'),
 (N'备注',              N'Remark'),
 (N'单据编号',          N'Document No.'),
 (N'单据日期',          N'Document Date'),
 (N'委托单位',          N'Client'),
 (N'委托单位地址',      N'Client Address'),
 (N'制造商',            N'Manufacturer'),
 (N'制造商地址',        N'Manufacturer Address'),
 (N'生产厂',            N'Production Plant'),
 (N'生产厂地址',        N'Production Plant Address'),
 (N'联系人',            N'Contact Person'),
 (N'联系电话（手机）',  N'Phone (Mobile)'),
 (N'邮箱',              N'Email'),
 (N'样品名称',          N'Sample Name'),
 (N'商标',              N'Trademark'),
 (N'样品数量',          N'Sample Quantity'),
 (N'样品型号/规格',     N'Sample Model / Specification'),
 (N'检验类别',          N'Inspection Category'),
 (N'检验依据',          N'Inspection Basis'),
 (N'检验项目及要求',    N'Inspection Items & Requirements'),
 (N'样品处理方式',      N'Sample Disposal Method'),
 (N'样品处理备注',      N'Sample Disposal Remark'),
 (N'判定规则',          N'Judgment Rule'),
 (N'其他判定规则',      N'Other Judgment Rule'),
 (N'报告类型',          N'Report Type'),
 (N'检验报告有效期',    N'Report Validity'),
 (N'有效期年数',        N'Validity (Years)'),
 (N'合计收费',          N'Total Fee'),
 (N'委托单位确认',      N'Client Confirmation'),
 (N'业务经办人确认',    N'Handler Confirmation'),
 (N'审核人',            N'Auditor'),
 (N'审核时间',          N'Audit Time'),
 (N'单据状态',          N'Document Status'),
 (N'行号',              N'Line No.');
DECLARE @lb nvarchar(60), @en nvarchar(160);
DECLARE curt CURSOR LOCAL FAST_FORWARD FOR SELECT label, en FROM @ft;
OPEN curt FETCH NEXT FROM curt INTO @lb, @en;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = @lb AND locale = N'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'field', @lb, N'en', @en, N'manual');
  FETCH NEXT FROM curt INTO @lb, @en;
END
CLOSE curt DEALLOCATE curt;
GO

/* ============ G. 中文注明(全量部署规范:表级 100% + 关键列;class=1 防索引号撞列号) ============ */
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.qc_sample_reg') AND minor_id = 0 AND name = N'MS_Description' AND class = 1)
  EXEC sp_addextendedproperty N'MS_Description',
    N'送样登记表/内部检测目录(2026-11-15;品质管理→样品检验;一行 = 一个可检验项目:检测元素/内部检出限/检测误差/测试方法/测试周期/收费/检测标准;检验委托单「检验类别」从这里带入项目)',
    N'SCHEMA', N'dbo', N'TABLE', N'qc_sample_reg';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.qc_insp_commission_head') AND minor_id = 0 AND name = N'MS_Description' AND class = 1)
  EXEC sp_addextendedproperty N'MS_Description',
    N'检验委托单头表(委托检验合同 YJ-QP-701-1-01 (00);2026-11-15;品质管理→样品检验;委托方信息 + 样品信息 + 检验类别/依据 + 处理方式/判定规则/报告类型/有效期 + 双方确认;审批流走通用单级)',
    N'SCHEMA', N'dbo', N'TABLE', N'qc_insp_commission_head';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.qc_insp_commission_detail') AND minor_id = 0 AND name = N'MS_Description' AND class = 1)
  EXEC sp_addextendedproperty N'MS_Description',
    N'检验委托单行表(2026-11-15;一行 = 从送样登记表带入的一个检验项目快照:检测元素/内部检出限/检测误差/测试方法/测试周期/收费/检测标准;不建外键,改目录不影响已建单据)',
    N'SCHEMA', N'dbo', N'TABLE', N'qc_insp_commission_detail';
GO

DECLARE @cols TABLE (tbl sysname, col sysname, note nvarchar(400));
INSERT INTO @cols (tbl, col, note) VALUES
 (N'qc_sample_reg', N'id',             N'主键(bigint IDENTITY);面板 SAMPLE_REG 的 pk_col'),
 (N'qc_sample_reg', N'序号',           N'目录行号(源 xls 1..43;外送部分 44),可手改'),
 (N'qc_sample_reg', N'检测元素',       N'检测项目名(锂/钠/镁/PH/TDS/硬度/COD/粒径等级…);面板 code_col + 唯一键'),
 (N'qc_sample_reg', N'内部检出限',     N'内部检出限(出报告需核对 5750.1,保留原文)'),
 (N'qc_sample_reg', N'检测误差',       N'检测误差(源 xls 合并格已展开到每行:5%-10% / 10% / 2% …)'),
 (N'qc_sample_reg', N'测试方法',       N'测试方法:ICPMS/火焰法/哈希/气相/分光/PH计/滴定/激光…'),
 (N'qc_sample_reg', N'测试周期',       N'测试周期:两天/一天/半天/周期7天'),
 (N'qc_sample_reg', N'收费',           N'收费(一个样/元);面板 label=收费（一个样/元)'),
 (N'qc_sample_reg', N'检测标准',       N'检测标准:GB/T 5750.6-2023 / HJ700-2014 / GB 7484-87 / NSF42 …'),
 (N'qc_sample_reg', N'检测标准备注',   N'检测标准备注:方法名/外送说明'),
 (N'qc_sample_reg', N'备注',           N'目录备注(如「外送部分」)'),
 (N'qc_sample_reg', N'asp_cancel',     N'软删标志(Y/N);引擎固定过滤 ISNULL(asp_cancel,N''N'')<>''Y'''),
 (N'qc_insp_commission_head', N'id',             N'主键(bigint IDENTITY);面板 INSP_COMMISSION 的 pk_col'),
 (N'qc_insp_commission_head', N'单据编号',       N'单据号:号池前缀 WT,形如 WT-2026-11-0001(FormNoService 取号)'),
 (N'qc_insp_commission_head', N'单据日期',       N'纸面「年 月 日」;面板 date_col'),
 (N'qc_insp_commission_head', N'委托单位',       N'委托方单位名称(纸面第 1 行)'),
 (N'qc_insp_commission_head', N'委托单位地址',   N'委托方地址'),
 (N'qc_insp_commission_head', N'制造商',         N'制造商名称'),
 (N'qc_insp_commission_head', N'制造商地址',     N'制造商地址'),
 (N'qc_insp_commission_head', N'生产厂',         N'生产厂名称'),
 (N'qc_insp_commission_head', N'生产厂地址',     N'生产厂地址'),
 (N'qc_insp_commission_head', N'联系人',         N'委托方联系人'),
 (N'qc_insp_commission_head', N'联系电话手机',   N'联系电话(手机);纸面 label=联系电话（手机）'),
 (N'qc_insp_commission_head', N'邮箱',           N'E-mail(纸面列头印 E-mail)'),
 (N'qc_insp_commission_head', N'样品名称',       N'送检样品名称'),
 (N'qc_insp_commission_head', N'商标',           N'样品商标'),
 (N'qc_insp_commission_head', N'样品数量',       N'样品数量(文本,允许「2L/3支」这类写法)'),
 (N'qc_insp_commission_head', N'样品型号规格',   N'样品型号/规格;纸面 label=样品型号/规格'),
 (N'qc_insp_commission_head', N'检验类别',       N'检验类别:由送样登记表带入的检验项目名摘要(「、」拼接),纸面点「选择检验项目」维护'),
 (N'qc_insp_commission_head', N'检验依据',       N'检验依据:带入项目的「检测标准」去重后「；」拼接,可手改'),
 (N'qc_insp_commission_head', N'检验项目及要求', N'检验项目及要求:全项/部分项目(注明具体章节号),纸面行表另渲染带入的检验项目'),
 (N'qc_insp_commission_head', N'样品处理方式',   N'样品处理方式(单选):委托单位自行取走 / 委托单位自愿放弃 / 委托单位委托检验机构代办样品托运手续'),
 (N'qc_insp_commission_head', N'样品处理备注',   N'样品处理备注:代办托运时填样品接收人/联系电话(手机)/邮寄地址'),
 (N'qc_insp_commission_head', N'判定规则',       N'判定规则(单选):按标准限值判定 / 其他判定规则 / 无需判定'),
 (N'qc_insp_commission_head', N'其他判定规则',   N'其他判定规则(判定规则=其他判定规则 时填写)'),
 (N'qc_insp_commission_head', N'报告类型',       N'报告类型(单选):普通报告 / CNAS 报告'),
 (N'qc_insp_commission_head', N'检验报告有效期', N'检验报告有效期(单选):长期有效 / 规定有效期'),
 (N'qc_insp_commission_head', N'有效期年数',     N'规定有效期的年数(decimal 18,2);「长期有效」时留空'),
 (N'qc_insp_commission_head', N'合计收费',       N'合计收费 = 行表「收费」求和(纸面自动回写,只读)'),
 (N'qc_insp_commission_head', N'备注',           N'备注(纸面「备 注」格)'),
 (N'qc_insp_commission_head', N'委托单位确认',   N'委托单位确认、日期(纸面签署格)'),
 (N'qc_insp_commission_head', N'业务经办人确认', N'业务经办人确认、日期(纸面签署格)'),
 (N'qc_insp_commission_head', N'审核人',         N'审核人:审批通过时落值(与 yj_doc_status.shr 同源);保存接口不接收前端改值'),
 (N'qc_insp_commission_head', N'审核时间',       N'审核时间(审批通过时刻)'),
 (N'qc_insp_commission_head', N'单据状态',       N'单据状态:草稿/审批中/已审核(引擎通用;不设固定默认值,避免与 yj_doc_status 双真源)'),
 (N'qc_insp_commission_head', N'asp_cancel',     N'软删标志(Y/N)'),
 (N'qc_insp_commission_detail', N'id',             N'主键(bigint IDENTITY)'),
 (N'qc_insp_commission_detail', N'单据编号',       N'关联头表 qc_insp_commission_head.单据编号(组键 group_col)'),
 (N'qc_insp_commission_detail', N'行号',           N'纸面行序 1..n(前端发号;列表/纸面按它排序)'),
 (N'qc_insp_commission_detail', N'检测元素',       N'目录快照:检验项目名'),
 (N'qc_insp_commission_detail', N'内部检出限',     N'目录快照:内部检出限'),
 (N'qc_insp_commission_detail', N'检测误差',       N'目录快照:检测误差'),
 (N'qc_insp_commission_detail', N'测试方法',       N'目录快照:测试方法'),
 (N'qc_insp_commission_detail', N'测试周期',       N'目录快照:测试周期'),
 (N'qc_insp_commission_detail', N'收费',           N'目录快照:收费(一个样/元);面板 label=收费（一个样/元)'),
 (N'qc_insp_commission_detail', N'检测标准',       N'目录快照:检测标准'),
 (N'qc_insp_commission_detail', N'检测标准备注',   N'目录快照:检测标准备注'),
 (N'qc_insp_commission_detail', N'备注',           N'行备注'),
 (N'qc_insp_commission_detail', N'asp_cancel',     N'软删标志(Y/N);闭合单删除行=软删');
DECLARE @t2 sysname, @c4 sysname, @n2 nvarchar(400);
DECLARE curc CURSOR LOCAL FAST_FORWARD FOR SELECT tbl, col, note FROM @cols;
OPEN curc FETCH NEXT FROM curc INTO @t2, @c4, @n2;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.' + @t2)
                   AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.' + @t2), @c4, 'ColumnId')
                   AND name = N'MS_Description' AND class = 1)
    EXEC sp_addextendedproperty N'MS_Description', @n2, N'SCHEMA', N'dbo', N'TABLE', @t2, N'COLUMN', @c4;
  FETCH NEXT FROM curc INTO @t2, @c4, @n2;
END
CLOSE curc DEALLOCATE curc;
GO

/* ============ H. 自检(缺一即 RAISERROR 16;DbSync 判失败且不写 yj_schema_log) ============ */
DECLARE @bad int = 0;
DECLARE @msg nvarchar(600) = N'';
IF OBJECT_ID(N'dbo.qc_sample_reg', N'U') IS NULL BEGIN SET @bad += 1; SET @msg += N'缺送样登记表;'; END
IF OBJECT_ID(N'dbo.qc_insp_commission_head', N'U') IS NULL BEGIN SET @bad += 1; SET @msg += N'缺委托单头表;'; END
IF OBJECT_ID(N'dbo.qc_insp_commission_detail', N'U') IS NULL BEGIN SET @bad += 1; SET @msg += N'缺委托单行表;'; END
IF COL_LENGTH(N'dbo.qc_sample_reg', N'asp_cancel') IS NULL BEGIN SET @bad += 1; SET @msg += N'目录表缺 asp_cancel;'; END
IF COL_LENGTH(N'dbo.qc_insp_commission_head', N'asp_cancel') IS NULL BEGIN SET @bad += 1; SET @msg += N'头表缺 asp_cancel;'; END
IF COL_LENGTH(N'dbo.qc_insp_commission_detail', N'asp_cancel') IS NULL BEGIN SET @bad += 1; SET @msg += N'行表缺 asp_cancel;'; END
IF COL_LENGTH(N'dbo.qc_insp_commission_detail', N'检测元素') IS NULL BEGIN SET @bad += 1; SET @msg += N'行表缺 检测元素;'; END
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = N'SAMPLE_REG') BEGIN SET @bad += 1; SET @msg += N'缺 SAMPLE_REG 面板;'; END
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = N'INSP_COMMISSION') BEGIN SET @bad += 1; SET @msg += N'缺 INSP_COMMISSION 面板;'; END
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = N'INSP_COMMISSION' AND prefix = N'WT' AND mode = N'doc') BEGIN SET @bad += 1; SET @msg += N'INSP_COMMISSION 面板 mode/prefix 未按约定登记;'; END
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'SAMPLE_REG') <> 10 BEGIN SET @bad += 1; SET @msg += N'送样登记表字段数<>10;'; END
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'INSP_COMMISSION' AND place LIKE N'%header%') <> 32 BEGIN SET @bad += 1; SET @msg += N'委托单头字段数<>32;'; END
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'INSP_COMMISSION' AND place LIKE N'%detail%') <> 9 BEGIN SET @bad += 1; SET @msg += N'委托单行字段数<>9;'; END
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'INSP_COMMISSION' AND col_name = N'行号' AND place = N'detail' AND hidden = 1 AND visible = 0) BEGIN SET @bad += 1; SET @msg += N'行号未按隐藏登记;'; END
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'INSP_COMMISSION' AND col_name = N'联系电话手机' AND label = N'联系电话（手机）') BEGIN SET @bad += 1; SET @msg += N'联系电话 label 未按纸面文案登记;'; END
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'INSP_COMMISSION' AND col_name = N'收费' AND label = N'收费（一个样/元）' AND place = N'detail') BEGIN SET @bad += 1; SET @msg += N'行表收费 label 未按纸面文案登记;'; END
IF (SELECT COUNT(*) FROM dbo.qc_sample_reg WHERE ISNULL(asp_cancel, N'N') <> N'Y') < 44 BEGIN SET @bad += 1; SET @msg += N'检测目录种子不足 44 行;'; END
IF (SELECT COUNT(*) FROM yj_role_panel WHERE panel_code = N'SAMPLE_REG') = 0 BEGIN SET @bad += 1; SET @msg += N'缺送样登记表角色授权;'; END
IF (SELECT COUNT(*) FROM yj_role_panel WHERE panel_code = N'INSP_COMMISSION') = 0 BEGIN SET @bad += 1; SET @msg += N'缺检验委托单角色授权;'; END
IF (SELECT COUNT(*) FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.qc_sample_reg') AND minor_id = 0 AND name = N'MS_Description') = 0 BEGIN SET @bad += 1; SET @msg += N'缺目录表注明;'; END
IF (SELECT COUNT(*) FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.qc_insp_commission_head') AND minor_id = 0 AND name = N'MS_Description') = 0 BEGIN SET @bad += 1; SET @msg += N'缺头表注明;'; END
IF (SELECT COUNT(*) FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.qc_insp_commission_detail') AND minor_id = 0 AND name = N'MS_Description') = 0 BEGIN SET @bad += 1; SET @msg += N'缺行表注明;'; END
IF (SELECT COUNT(*) FROM sys.extended_properties WHERE name = N'MS_Description' AND class = 1 AND minor_id > 0
      AND major_id IN (OBJECT_ID(N'dbo.qc_sample_reg'), OBJECT_ID(N'dbo.qc_insp_commission_head'), OBJECT_ID(N'dbo.qc_insp_commission_detail'))) < 40
  BEGIN SET @bad += 1; SET @msg += N'关键列注明不足 40;'; END
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'panel' AND ref_key = N'送样登记表' AND locale = N'en') BEGIN SET @bad += 1; SET @msg += N'缺送样登记表 en 译名;'; END
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'panel' AND ref_key = N'检验委托单' AND locale = N'en') BEGIN SET @bad += 1; SET @msg += N'缺检验委托单 en 译名;'; END
IF (SELECT COUNT(*) FROM yj_field f WHERE f.panel_code IN (N'SAMPLE_REG', N'INSP_COMMISSION')
      AND NOT EXISTS (SELECT 1 FROM yj_translation t WHERE t.scope = N'field' AND t.ref_key = f.label AND t.locale = N'en')) > 0
  BEGIN SET @bad += 1; SET @msg += N'有字段标签缺 en 译名;'; END
IF @bad > 0 RAISERROR(N'样品检验迁移自检失败(缺表/缺面板/缺字段/缺授权/缺注明/缺译名):%s', 16, 1, @msg);
ELSE PRINT N'样品检验就绪(SAMPLE_REG / INSP_COMMISSION / qc_sample_reg / qc_insp_commission_head / qc_insp_commission_detail,目录 44 行)';
GO
