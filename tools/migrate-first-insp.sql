/* migrate-first-insp.sql(2026-10-15):首件检验单 —— QC_FIRST_INSP
 *
 * 需求来源(用户 2026-10-15 口径):
 *   「当前增加首件检验,实现方式参考成品检验单,首件检验的数据来源于当前生产工单的单据
 *     当前批次第一次报工产生,检验方式参考成型工艺清单内的检验要求进行编写」。
 *
 * 逐句落地:
 *   ① 「实现方式参考成品检验单」= 与 QC_ASM_INSP(成品检验单)**同构**:
 *      头表列集照抄 qc_asm_insp_head(32 列),行表取其检验项目区那一段
 *      (检验项目/检验要求/检验方法/检查频率/实测数值/测量值1..5/结果判断/数量/不合格数量/
 *       处理方式/备注),不引入「出货功能性测试」专有的 产线常规功能性结果;
 *   ② 「数据来源于当前生产工单…当前批次第一次报工」= 报工**审核**时判定「本(工单号,批次号,
 *      工单行号)是否还没有更早的已审核报工」,是则自动出一张首件检验单草稿
 *      (见 ButtonService.firstInspGenerate);占用链走 form_flow_link,与三张工序检验单同一套
 *      —— 报工弃审会把它一并作废、可再次生成;
 *   ③ 「检验方式参考成型工艺清单内的检验要求编写」= 明细预铺《成型工艺清单》RD_MOLD_PROC
 *      「检验要求」区块的 5 个检验项目(炭棒尺寸/密度管控/跌落强度/抗压强度/压降),
 *      检验要求按该单对应字段拼成(见 FirstInspItems);单上另有「取成型工艺清单」按钮,
 *      工艺清单后续维护好了可重新带入。
 *
 * 表样依据(逐列实测 HSDZ_MES):
 *   qc_asm_insp_head  32 列 / qc_asm_insp_detail 27 列 —— 本单头 33 列(+工艺清单单号,留来源痕迹)、
 *   行 24 列。qc_ 前缀 = 品质管理单据(数据库规范 §0)。
 *
 * 规范符合性:头行成对;主键 id + 审计四件套 asp_user1/2 + asp_time1/2;asp_cancel nvarchar(1) 默认 'N';
 *   表与关键列均写 MS_Description 中文注明(全量部署规范);面板 + 新字段 en 译名(AGENTS.md 强制),
 *   十语言显示层词条同批进 frontend/src/i18n/locales 下的各语言 js。
 * 幂等:建表 IF OBJECT_ID IS NULL、字段 INSERT 走 NOT EXISTS、注明 IF NOT EXISTS;两账套均执行。
 */

/* ============ A. 建表 ============ */
IF OBJECT_ID(N'dbo.qc_first_insp_head', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.qc_first_insp_head (
    id           bigint IDENTITY(1,1) NOT NULL CONSTRAINT pk_qc_first_insp_head PRIMARY KEY,
    单据编号     nvarchar(50)  NOT NULL,
    单据日期     date          NULL,
    工单号       nvarchar(50)  NULL,
    工单行号     int           NULL,
    报工单号     nvarchar(50)  NULL,
    工序         nvarchar(50)  NULL,
    批次号       nvarchar(50)  NULL,
    客户名称     nvarchar(200) NULL,
    产品编码     nvarchar(50)  NULL,
    产品名称     nvarchar(200) NULL,
    规格型号     nvarchar(200) NULL,
    生产线       nvarchar(50)  NULL,
    生产车间     nvarchar(50)  NULL,
    报工数量     decimal(18,4) NULL,
    检验数量     decimal(18,4) NULL,
    检验员       nvarchar(50)  NULL,
    检验日期     date          NULL,
    总结论       nvarchar(20)  NULL,
    工艺清单单号 nvarchar(50)  NULL,   /* 检验要求取自哪张《成型工艺清单》(RD_MOLD_PROC);查无则空 */
    处理方式     nvarchar(50)  NULL,
    备注         nvarchar(500) NULL,
    审核人       nvarchar(50)  NULL,
    审核时间     datetime2     NULL,
    单据状态     nvarchar(20)  NULL,
    检验方案     nvarchar(200) NULL,
    文件编码     nvarchar(50)  NULL,
    执行标准     nvarchar(200) NULL,
    asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL,
    asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL,
    asp_cancel nvarchar(1) NULL CONSTRAINT df_qc_first_insp_head_cancel DEFAULT (N'N')
  );
  PRINT N'[OK] qc_first_insp_head 已建';
END
ELSE PRINT N'[SKIP] qc_first_insp_head 已存在';
GO

IF OBJECT_ID(N'dbo.qc_first_insp_detail', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.qc_first_insp_detail (
    id           bigint IDENTITY(1,1) NOT NULL CONSTRAINT pk_qc_first_insp_detail PRIMARY KEY,
    单据编号     nvarchar(50)  NOT NULL,
    表区         nvarchar(50)  NULL,   /* 检验项目 / 数量判定(与三张工序检验单同口径) */
    行号         int           NULL,
    检验项目     nvarchar(100) NULL,
    检验要求     nvarchar(500) NULL,   /* 来源=成型工艺清单 RD_MOLD_PROC 的「检验要求」区块 */
    检验方法     nvarchar(1000) NULL,
    检查频率     nvarchar(50)  NULL,
    实测数值     nvarchar(500) NULL,   /* 定性描述/一串文本;多个数值走 测量值1..5 */
    测量值1      decimal(18,4) NULL,
    测量值2      decimal(18,4) NULL,
    测量值3      decimal(18,4) NULL,
    测量值4      decimal(18,4) NULL,
    测量值5      decimal(18,4) NULL,
    结果判断     nvarchar(20)  NULL,   /* 合格/不合格 */
    数量         decimal(18,4) NULL,
    不合格数量   decimal(18,4) NULL,
    处理方式     nvarchar(50)  NULL,
    备注         nvarchar(200) NULL,
    asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL,
    asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL,
    asp_cancel nvarchar(1) NULL CONSTRAINT df_qc_first_insp_detail_cancel DEFAULT (N'N')
  );
  PRINT N'[OK] qc_first_insp_detail 已建';
END
ELSE PRINT N'[SKIP] qc_first_insp_detail 已存在';
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_qc_first_insp_head_no' AND object_id = OBJECT_ID(N'dbo.qc_first_insp_head'))
  CREATE INDEX ix_qc_first_insp_head_no ON dbo.qc_first_insp_head (单据编号, 报工单号);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_qc_first_insp_head_wo' AND object_id = OBJECT_ID(N'dbo.qc_first_insp_head'))
  CREATE INDEX ix_qc_first_insp_head_wo ON dbo.qc_first_insp_head (工单号, 批次号);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_qc_first_insp_detail_no' AND object_id = OBJECT_ID(N'dbo.qc_first_insp_detail'))
  CREATE INDEX ix_qc_first_insp_detail_no ON dbo.qc_first_insp_detail (单据编号, 表区);
GO

/* ============ B. 面板登记 ============ */
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = N'QC_FIRST_INSP')
  INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group)
  VALUES (N'QC_FIRST_INSP', N'首件检验单', N'生产管理', 'doc', N'qc_first_insp_detail', N'qc_first_insp_head',
          N'单据编号', N'id', N'单据编号', N'SJ', N'单据日期', 20, N'items', N'生产制造');
GO

/* ============ C. 字段登记(头:与 QC_ASM_INSP 对齐 + 工艺清单单号) ============ */
DECLARE @fh TABLE (col nvarchar(50), place nvarchar(30), seq int, width int, editable int, required int, dtype nvarchar(20));
INSERT INTO @fh VALUES
 (N'单据编号',     N'query,header',  10, 140, 0, 1, N'文本'),
 (N'单据日期',     N'query,header',  20, 110, 1, 1, N'文本'),
 (N'工单号',       N'query,header',  30, 140, 1, 1, N'文本'),
 (N'工单行号',     N'query,header',  35, 80,  0, 0, N'整数'),
 (N'报工单号',     N'query,header',  40, 140, 1, 0, N'文本'),
 (N'工序',         N'query,header',  50, 90,  1, 0, N'文本'),
 (N'批次号',       N'query,header',  60, 110, 1, 0, N'文本'),
 (N'客户名称',     N'query,header',  65, 180, 1, 0, N'文本'),
 (N'产品编码',     N'query,header',  70, 120, 1, 0, N'文本'),
 (N'产品名称',     N'query,header',  80, 180, 1, 0, N'文本'),
 (N'规格型号',     N'header',        90, 160, 1, 0, N'文本'),
 (N'生产线',       N'query,header', 100, 110, 1, 0, N'文本'),
 (N'生产车间',     N'header',       110, 110, 1, 0, N'文本'),
 (N'报工数量',     N'header',       120, 100, 1, 0, N'文本'),
 (N'检验数量',     N'header',       130, 100, 1, 0, N'文本'),
 (N'检验员',       N'query,header', 140, 100, 1, 0, N'文本'),
 (N'检验日期',     N'header',       150, 110, 1, 0, N'文本'),
 (N'检验方案',     N'query,header', 155, 160, 1, 0, N'参照'),
 (N'总结论',       N'query,header', 160, 100, 1, 0, N'文本'),
 (N'文件编码',     N'query,header', 165, 110, 1, 0, N'文本'),
 (N'工艺清单单号', N'query,header', 170, 140, 0, 0, N'文本'),
 (N'执行标准',     N'header',       175, 160, 1, 0, N'文本'),
 (N'单据状态',     N'query,header', 190, 90,  0, 0, N'文本'),
 (N'审核人',       N'header',       200, 90,  0, 0, N'文本'),
 (N'审核时间',     N'header',       210, 140, 0, 0, N'文本');
DECLARE @c nvarchar(50), @p nvarchar(30), @s int, @w int, @e int, @r int, @dt nvarchar(20);
DECLARE curf CURSOR LOCAL FAST_FORWARD FOR SELECT col, place, seq, width, editable, required, dtype FROM @fh;
OPEN curf FETCH NEXT FROM curf INTO @c, @p, @s, @w, @e, @r, @dt;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_FIRST_INSP' AND col_name = @c)
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES (N'QC_FIRST_INSP', @c, @c, @dt, @p, @s, @w, @e, @r, 0, 1);
  FETCH NEXT FROM curf INTO @c, @p, @s, @w, @e, @r, @dt;
END
CLOSE curf DEALLOCATE curf;
GO

/* 处理方式/备注 是「一行两用」(表头里也有),与 QC_ASM_INSP 同款 */
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_FIRST_INSP' AND col_name = N'处理方式')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES (N'QC_FIRST_INSP', N'处理方式', N'处理方式', N'多行文本', N'header,detail', 130, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_FIRST_INSP' AND col_name = N'备注')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES (N'QC_FIRST_INSP', N'备注', N'备注', N'多行文本', N'header,detail', 180, 200, 1, 0, 0, 1);
GO

/* ============ D. 字段登记(明细:照 QC_ASM_INSP 的检验项目区) ============ */
DECLARE @fd TABLE (col nvarchar(50), seq int, width int, editable int, required int, hidden int, dtype nvarchar(20));
INSERT INTO @fd VALUES
 (N'检验项目',   10,  160, 1, 0, 0, N'多行文本'),
 (N'检验要求',   20,  180, 1, 0, 0, N'多行文本'),
 (N'检验方法',   30,  320, 1, 0, 0, N'多行文本'),
 (N'实测数值',   40,  120, 1, 0, 0, N'多行文本'),
 (N'测量值1',    50,  80,  1, 0, 0, N'小数'),
 (N'测量值2',    60,  80,  1, 0, 0, N'小数'),
 (N'测量值3',    70,  80,  1, 0, 0, N'小数'),
 (N'测量值4',    80,  80,  1, 0, 0, N'小数'),
 (N'测量值5',    90,  80,  1, 0, 0, N'小数'),
 (N'检查频率',   100, 110, 1, 0, 0, N'下拉框'),
 (N'数量',       110, 100, 1, 0, 0, N'文本'),
 (N'不合格数量', 120, 90,  1, 0, 0, N'小数'),
 (N'结果判断',   150, 90,  1, 0, 0, N'文本'),
 (N'行号',       160, 70,  0, 0, 1, N'文本'),
 (N'表区',       170, 90,  0, 0, 1, N'文本');
DECLARE @c2 nvarchar(50), @s2 int, @w2 int, @e2 int, @r2 int, @h2 int, @d2 nvarchar(20);
DECLARE curd CURSOR LOCAL FAST_FORWARD FOR SELECT col, seq, width, editable, required, hidden, dtype FROM @fd;
OPEN curd FETCH NEXT FROM curd INTO @c2, @s2, @w2, @e2, @r2, @h2, @d2;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_FIRST_INSP' AND col_name = @c2)
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES (N'QC_FIRST_INSP', @c2, @c2, @d2, N'detail', @s2, @w2, @e2, @r2, @h2, CASE WHEN @h2 = 1 THEN 0 ELSE 1 END);
  FETCH NEXT FROM curd INTO @c2, @s2, @w2, @e2, @r2, @h2, @d2;
END
CLOSE curd DEALLOCATE curd;
GO

/* 检查频率 的候选值镜像三张工序检验单(报工单/批次口径) */
UPDATE yj_field
   SET dict_sql = N'SELECT v FROM (VALUES (N''1PCS/一个生产批次''),(N''生产量*1%''),(N''型式检验'')) AS t(v)'
 WHERE panel_code = N'QC_FIRST_INSP' AND col_name = N'检查频率' AND (dict_sql IS NULL OR dict_sql = N'');
GO

/* ============ E. 角色授权 ============ */
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms)
SELECT r.id, N'QC_FIRST_INSP', N'N', N'view,query,add,modify,modlog,del,export'
FROM yj_role r
WHERE NOT EXISTS (SELECT 1 FROM yj_role_panel rp WHERE rp.role_id = r.id AND rp.panel_code = N'QC_FIRST_INSP');
GO

/* ============ F. 多语言(AGENTS.md 强制:新面板 + 新字段至少 en) ============ */
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'panel' AND ref_key = N'首件检验单' AND locale = N'en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source)
  VALUES (N'panel', N'首件检验单', N'en', N'First Article Inspection Sheet', N'manual');

DECLARE @ft TABLE (label nvarchar(50), en nvarchar(120));
INSERT INTO @ft VALUES
 (N'首件检验单',   N'First Article Inspection Sheet'),
 (N'工艺清单单号', N'Process Sheet No.'),
 (N'炭棒尺寸',     N'Rod Dimensions'),
 (N'密度管控',     N'Density Control'),
 (N'跌落强度',     N'Drop Strength'),
 (N'抗压强度',     N'Compressive Strength'),
 (N'压降',         N'Pressure Drop'),
 (N'行类型',       N'Row Type'),
 (N'样品序号',     N'Sample No.'),
 (N'检验列',       N'Inspection Column'),
 (N'标准',         N'Standard'),
 (N'项目分组',     N'Item Group');
DECLARE @lb nvarchar(50), @en nvarchar(120);
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

/* ============ G. 中文注明(全量部署规范:新表与关键列必须带 MS_Description) ============ */
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.qc_first_insp_head') AND minor_id = 0 AND name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description',
    N'首件检验单头表(2026-10-15:实现方式照组装成品检验单;本(工单号,批次号,工单行号)第一张报工审核时自动出一张草稿)',
    N'SCHEMA', N'dbo', N'TABLE', N'qc_first_insp_head';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.qc_first_insp_detail') AND minor_id = 0 AND name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description',
    N'首件检验单行表(检验项目/检验要求/检验方法/检查频率/实测数值/测量值1..5/结果判断;生成时按《成型工艺清单》RD_MOLD_PROC 的检验要求预铺 5 项)',
    N'SCHEMA', N'dbo', N'TABLE', N'qc_first_insp_detail';
GO

DECLARE @cols TABLE (tbl sysname, col sysname, note nvarchar(400));
INSERT INTO @cols (tbl, col, note) VALUES
 (N'qc_first_insp_head', N'工艺清单单号', N'检验要求取自哪张《成型工艺清单》(RD_MOLD_PROC);按产品编号取最新一张,查无则空'),
 (N'qc_first_insp_head', N'工单行号',     N'生产工单行键(工单号+工单行号唯一确定一行;取自 scjl.[工单行号],缺则由 gd_id/批次反查)'),
 (N'qc_first_insp_head', N'总结论',       N'整张首件检验的结论:合格/不合格'),
 (N'qc_first_insp_head', N'客户名称',     N'由工单客户带入(与 QC_ASM_INSP/QC_PROC_INSP 同列)'),
 (N'qc_first_insp_detail', N'表区',       N'检验项目 / 数量判定(与三张工序检验单同一口径)'),
 (N'qc_first_insp_detail', N'检验项目',   N'生成时按《成型工艺清单》检验要求区块预铺:炭棒尺寸/密度管控/跌落强度/抗压强度/压降'),
 (N'qc_first_insp_detail', N'检验要求',   N'来源=成型工艺清单 RD_MOLD_PROC 的检验要求字段(炭棒尺寸/密度管控/跌落强度/抗压强度/压降 各段的取值拼接)'),
 (N'qc_first_insp_detail', N'检验方法',   N'截图「检验方法」;成型工艺清单无该字段,由品质填写或从检验项目标准库带入'),
 (N'qc_first_insp_detail', N'实测数值',   N'定性描述或一串文本;多个数值走 测量值1..5 五个数值列'),
 (N'qc_first_insp_detail', N'测量值1',    N'实测数值分格(用到几格填几格),与三张工序检验单同口径'),
 (N'qc_first_insp_detail', N'结果判断',   N'单项判定:合格/不合格'),
 (N'qc_first_insp_detail', N'不合格数量', N'本检验项目在该批次/该工单行上的不合格数量(品质手填)');
DECLARE @t2 sysname, @c3 sysname, @n2 nvarchar(400);
DECLARE curc CURSOR LOCAL FAST_FORWARD FOR SELECT tbl, col, note FROM @cols;
OPEN curc FETCH NEXT FROM curc INTO @t2, @c3, @n2;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.' + @t2)
                   AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.' + @t2), @c3, 'ColumnId')
                   AND name = N'MS_Description' AND class = 1)
    EXEC sp_addextendedproperty N'MS_Description', @n2, N'SCHEMA', N'dbo', N'TABLE', @t2, N'COLUMN', @c3;
  FETCH NEXT FROM curc INTO @t2, @c3, @n2;
END
CLOSE curc DEALLOCATE curc;
GO

/* ============ H. 图片版动态列模型补充 ============
 * 一条明细 = 一个样品 × 一个检验列；行类型=标准时填「标准」行，行类型=样品时填实测值。
 * 检验列由 RD_MOLD_PROC 当前非空要求动态决定，因此不同产品可以有不同列集。
 */
IF COL_LENGTH(N'dbo.qc_first_insp_detail', N'行类型') IS NULL ALTER TABLE dbo.qc_first_insp_detail ADD [行类型] nvarchar(20) NULL;
IF COL_LENGTH(N'dbo.qc_first_insp_detail', N'样品序号') IS NULL ALTER TABLE dbo.qc_first_insp_detail ADD [样品序号] nvarchar(20) NULL;
IF COL_LENGTH(N'dbo.qc_first_insp_detail', N'检验列') IS NULL ALTER TABLE dbo.qc_first_insp_detail ADD [检验列] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.qc_first_insp_detail', N'标准') IS NULL ALTER TABLE dbo.qc_first_insp_detail ADD [标准] nvarchar(500) NULL;
IF COL_LENGTH(N'dbo.qc_first_insp_detail', N'项目分组') IS NULL ALTER TABLE dbo.qc_first_insp_detail ADD [项目分组] nvarchar(50) NULL;
GO
DECLARE @dyn TABLE (col sysname, note nvarchar(400));
INSERT INTO @dyn VALUES
 (N'行类型', N'动态首件纸张行类型:标准或样品'),
 (N'样品序号', N'图片版首件检验样品序号:1#至8#'),
 (N'检验列', N'由成型工艺清单非空检验要求动态生成的列键'),
 (N'标准', N'由成型工艺清单检验要求填入图片版标准行'),
 (N'项目分组', N'图片版动态检验列所属分组:表观及脱粉/尺寸及重量/强度/浊度及压降');
DECLARE @dc sysname, @dn nvarchar(400);
DECLARE curdyn CURSOR LOCAL FAST_FORWARD FOR SELECT col,note FROM @dyn;
OPEN curdyn FETCH NEXT FROM curdyn INTO @dc,@dn;
WHILE @@FETCH_STATUS=0
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.qc_first_insp_detail') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.qc_first_insp_detail'),@dc,'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description',@dn,N'SCHEMA',N'dbo',N'TABLE',N'qc_first_insp_detail',N'COLUMN',@dc;
  FETCH NEXT FROM curdyn INTO @dc,@dn;
END
CLOSE curdyn DEALLOCATE curdyn;
GO
DECLARE @dynamicFields TABLE (col nvarchar(50), seq int, width int, dtype nvarchar(20));
INSERT INTO @dynamicFields VALUES
 (N'行类型', 165, 80, N'文本'),(N'样品序号',166,80,N'文本'),(N'检验列',167,110,N'文本'),(N'标准',168,260,N'多行文本'),(N'项目分组',169,120,N'文本');
DECLARE @df nvarchar(50), @ds int, @dw int, @dd nvarchar(20);
DECLARE curdf CURSOR LOCAL FAST_FORWARD FOR SELECT col,seq,width,dtype FROM @dynamicFields;
OPEN curdf FETCH NEXT FROM curdf INTO @df,@ds,@dw,@dd;
WHILE @@FETCH_STATUS=0
BEGIN
  IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code=N'QC_FIRST_INSP' AND col_name=@df)
    INSERT INTO yj_field(panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible)
    VALUES(N'QC_FIRST_INSP',@df,@df,@dd,N'detail',@ds,@dw,1,0,1,0);
  FETCH NEXT FROM curdf INTO @df,@ds,@dw,@dd;
END
CLOSE curdf DEALLOCATE curdf;
GO

/* ============ I. 自检 ============ */
DECLARE @bad int = 0;
IF OBJECT_ID(N'dbo.qc_first_insp_head', N'U') IS NULL SET @bad = @bad + 1;
IF OBJECT_ID(N'dbo.qc_first_insp_detail', N'U') IS NULL SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = N'QC_FIRST_INSP') SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'QC_FIRST_INSP' AND place LIKE N'%header%') < 20 SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'QC_FIRST_INSP' AND place LIKE N'%detail%') < 20 SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.qc_first_insp_detail', N'行类型') IS NULL OR COL_LENGTH(N'dbo.qc_first_insp_detail', N'样品序号') IS NULL OR COL_LENGTH(N'dbo.qc_first_insp_detail', N'检验列') IS NULL OR COL_LENGTH(N'dbo.qc_first_insp_detail', N'标准') IS NULL OR COL_LENGTH(N'dbo.qc_first_insp_detail', N'项目分组') IS NULL SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.qc_first_insp_head', N'asp_cancel') IS NULL SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.qc_first_insp_detail', N'asp_cancel') IS NULL SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.qc_first_insp_head') AND minor_id = 0 AND name = N'MS_Description') = 0 SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.qc_first_insp_detail') AND minor_id = 0 AND name = N'MS_Description') = 0 SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'panel' AND ref_key = N'首件检验单' AND locale = N'en') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'工艺清单单号' AND locale = N'en') SET @bad = @bad + 1;
IF @bad > 0 RAISERROR(N'首件检验单迁移自检失败(缺表/缺面板/缺字段/缺注明/缺译名)', 16, 1);
ELSE PRINT N'首件检验单就绪(QC_FIRST_INSP / qc_first_insp_head / qc_first_insp_detail)';
GO
