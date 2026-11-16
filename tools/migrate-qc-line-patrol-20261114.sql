/* migrate-qc-line-patrol-20261114.sql(2026-11-14):成型车间巡线记录表 —— QC_LINE_PATROL
 *
 * 需求来源(用户 2026-11-14 口径):
 *   「新增成型车间巡线记录表,巡线检验入口,设定在品质模块下面。先可填即可。」
 *   追问后:形态 = 照第二张图做纸面样式;位置 = 品质管理 → 制程品质(放在「出厂检验报告」下面)。
 *
 * 唯一真源 = docs/design/成型车间巡线记录表-首版.md(DB 与前端两拨人按它对齐):
 *   一、纸面 12 列:巡线时间 | 车间 | 产品信息确认 | 炭棒长度范围mm | 内径检查mm | 重量范围g |
 *       两液密度 | 表面状态 | 跌落强度 | 抗压强度 | 结果判定 | 巡线人员;
 *       每个「记录块」= 一行,块内 4 子行(产品①/② 各 编号/型号 + 标准值/实测值),
 *       块级列在 4 子行上 rowspan=4 ⇒ **库表一行 = 一个记录块**,①②的 8 个值各一列。
 *   二、头行成对:qc_line_patrol_head / qc_line_patrol_detail,均带主键 + 审计四件套;
 *       detail 列名全中文、无括号/空格(列名安全规范);索引 (单据编号)。
 *   三、面板元数据 + 主表 24 个可见字段 + 行号(hidden=1) + 面板/字段 en 译名。
 *
 * 规范符合性(docs/development/数据库规范.md):
 *   前缀 qc_ = 品质单据(§1.1);主键 bigint IDENTITY + asp_user1/2 + asp_time1/2(§2.1);
 *   文本一律 nvarchar、日期 datetime2、状态 nvarchar(1) 且默认 'N'(§2.2);
 *   新表不写业务状态固定默认值(§2.3);面板 mode=doc / place 取值在收口集合内(§3)。
 *   表级与逐列 MS_Description 中文注明(AGENTS.md 全量部署规范,同脚本内、幂等)。
 *   面板 + 每个新标签 en 译名(AGENTS.md 多语言强制规范,已有全局译名的不重复插)。
 *
 * 幂等:建表 IF OBJECT_ID IS NULL;索引 IF NOT EXISTS;面板/字段/授权/译名全部 NOT EXISTS 守卫;
 *   注明 IF NOT EXISTS(class=1);末尾自检不过即 RAISERROR 16。两账套执行(先正式后测试)。
 */

/* ============ A. 建表 ============ */
IF OBJECT_ID(N'dbo.qc_line_patrol_head', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.qc_line_patrol_head (
    id            bigint IDENTITY(1,1) NOT NULL CONSTRAINT pk_qc_line_patrol_head PRIMARY KEY,
    单据编号      nvarchar(50)  NOT NULL,   /* 号池前缀 XJ:XJ-2026-11-0001 */
    单据日期      date          NULL,       /* 纸面「日期」 */
    审核人        nvarchar(50)  NULL,       /* 审批流以后接;本期纸面只读展示 */
    审核时间      datetime2     NULL,
    单据状态      nvarchar(20)  NULL,       /* 草稿/已提交/已审核(引擎通用,不写固定默认值) */
    备注          nvarchar(500) NULL,
    asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL,
    asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL,
    asp_cancel nvarchar(1) NULL CONSTRAINT df_qc_line_patrol_head_cancel DEFAULT (N'N')
  );
  PRINT N'[OK] qc_line_patrol_head 已建';
END
ELSE PRINT N'[SKIP] qc_line_patrol_head 已存在';
GO

IF OBJECT_ID(N'dbo.qc_line_patrol_detail', N'U') IS NULL
BEGIN
  /* 一行 = 纸面一个记录块(块内 4 子行由前端按 ①② 两组值渲染,库不拆子行) */
  CREATE TABLE dbo.qc_line_patrol_detail (
    id           bigint IDENTITY(1,1) NOT NULL CONSTRAINT pk_qc_line_patrol_detail PRIMARY KEY,
    单据编号     nvarchar(50)  NOT NULL,   /* 关联头 qc_line_patrol_head.单据编号 */
    行号         int           NULL,       /* 块序号 1..n(前端发号,列表/纸面按它排序) */
    巡线时间     nvarchar(20)  NULL,       /* 块级 */
    车间         nvarchar(50)  NULL,       /* 块级 */
    编号1        nvarchar(50)  NULL,       /* 产品① */
    型号1        nvarchar(100) NULL,
    长度标准1    nvarchar(50)  NULL,
    长度实测1    nvarchar(50)  NULL,
    内径标准1    nvarchar(50)  NULL,
    内径实测1    nvarchar(50)  NULL,
    重量标准1    nvarchar(50)  NULL,
    重量实测1    nvarchar(50)  NULL,
    编号2        nvarchar(50)  NULL,       /* 产品② */
    型号2        nvarchar(100) NULL,
    长度标准2    nvarchar(50)  NULL,
    长度实测2    nvarchar(50)  NULL,
    内径标准2    nvarchar(50)  NULL,
    内径实测2    nvarchar(50)  NULL,
    重量标准2    nvarchar(50)  NULL,
    重量实测2    nvarchar(50)  NULL,
    两液密度     nvarchar(50)  NULL,       /* 块级:伊玛印品耐水煮要求测试 */
    表面状态     nvarchar(50)  NULL,
    跌落强度     nvarchar(50)  NULL,
    抗压强度     nvarchar(50)  NULL,
    结果判定     nvarchar(20)  NULL,
    巡线人员     nvarchar(50)  NULL,
    asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL,
    asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL,
    asp_cancel nvarchar(1) NULL CONSTRAINT df_qc_line_patrol_detail_cancel DEFAULT (N'N')
  );
  PRINT N'[OK] qc_line_patrol_detail 已建';
END
ELSE PRINT N'[SKIP] qc_line_patrol_detail 已存在';
GO

/* 索引(契约 §二:索引 (单据编号);命名按数据库规范 §1.3 ix_<表>_<列>) */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_qc_line_patrol_head_no' AND object_id = OBJECT_ID(N'dbo.qc_line_patrol_head'))
  CREATE INDEX ix_qc_line_patrol_head_no ON dbo.qc_line_patrol_head (单据编号);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_qc_line_patrol_detail_no' AND object_id = OBJECT_ID(N'dbo.qc_line_patrol_detail'))
  CREATE INDEX ix_qc_line_patrol_detail_no ON dbo.qc_line_patrol_detail (单据编号);
GO

/* ============ B. 面板登记 ============ */
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = N'QC_LINE_PATROL')
  INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group)
  VALUES (N'QC_LINE_PATROL', N'成型车间巡线记录表', N'品质管理', 'doc',
          N'qc_line_patrol_detail', N'qc_line_patrol_head',
          N'单据编号', N'id', N'单据编号', N'XJ', N'单据日期', 20, N'items', N'品质管理');
GO

/* ============ C. 字段登记(头:契约 §三 place=query,header / seq 10·20·190·200·210) ============ */
DECLARE @fh TABLE (col nvarchar(50), place nvarchar(30), seq int, width int, editable int, required int, dtype nvarchar(20));
INSERT INTO @fh VALUES
 (N'单据编号', N'query,header',  10, 140, 0, 1, N'文本'),
 (N'单据日期', N'query,header',  20, 110, 1, 1, N'日期'),
 (N'单据状态', N'query,header', 190,  90, 0, 0, N'文本'),
 (N'审核人',   N'query,header', 200,  90, 0, 0, N'文本'),
 (N'审核时间', N'query,header', 210, 140, 0, 0, N'文本');
DECLARE @c nvarchar(50), @p nvarchar(30), @s int, @w int, @e int, @r int, @dt nvarchar(20);
DECLARE curf CURSOR LOCAL FAST_FORWARD FOR SELECT col, place, seq, width, editable, required, dtype FROM @fh;
OPEN curf FETCH NEXT FROM curf INTO @c, @p, @s, @w, @e, @r, @dt;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_LINE_PATROL' AND col_name = @c)
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES (N'QC_LINE_PATROL', @c, @c, @dt, @p, @s, @w, @e, @r, 0, 1);
  FETCH NEXT FROM curf INTO @c, @p, @s, @w, @e, @r, @dt;
END
CLOSE curf DEALLOCATE curf;
GO

/* ============ D. 字段登记(明细:照纸面列序 seq 10..240,行号 hidden 落 260) ============ */
DECLARE @fd TABLE (col nvarchar(50), seq int, width int, editable int, required int, hidden int, dtype nvarchar(20));
INSERT INTO @fd VALUES
 (N'巡线时间',  10, 100, 1, 0, 0, N'文本'),
 (N'车间',      20, 100, 1, 0, 0, N'文本'),
 (N'编号1',     30,  90, 1, 0, 0, N'文本'),
 (N'型号1',     40, 160, 1, 0, 0, N'文本'),
 (N'长度标准1', 50, 100, 1, 0, 0, N'文本'),
 (N'长度实测1', 60, 100, 1, 0, 0, N'文本'),
 (N'内径标准1', 70, 100, 1, 0, 0, N'文本'),
 (N'内径实测1', 80, 100, 1, 0, 0, N'文本'),
 (N'重量标准1', 90, 100, 1, 0, 0, N'文本'),
 (N'重量实测1',100, 100, 1, 0, 0, N'文本'),
 (N'编号2',    110,  90, 1, 0, 0, N'文本'),
 (N'型号2',    120, 160, 1, 0, 0, N'文本'),
 (N'长度标准2',130, 100, 1, 0, 0, N'文本'),
 (N'长度实测2',140, 100, 1, 0, 0, N'文本'),
 (N'内径标准2',150, 100, 1, 0, 0, N'文本'),
 (N'内径实测2',160, 100, 1, 0, 0, N'文本'),
 (N'重量标准2',170, 100, 1, 0, 0, N'文本'),
 (N'重量实测2',180, 100, 1, 0, 0, N'文本'),
 (N'两液密度', 190, 140, 1, 0, 0, N'文本'),
 (N'表面状态', 200, 110, 1, 0, 0, N'文本'),
 (N'跌落强度', 210, 100, 1, 0, 0, N'文本'),
 (N'抗压强度', 220, 100, 1, 0, 0, N'文本'),
 (N'结果判定', 230, 100, 1, 0, 0, N'文本'),
 (N'巡线人员', 240, 100, 1, 0, 0, N'文本'),
 (N'行号',     260,  70, 0, 0, 1, N'文本');
DECLARE @c2 nvarchar(50), @s2 int, @w2 int, @e2 int, @r2 int, @h2 int, @d2 nvarchar(20);
DECLARE curd CURSOR LOCAL FAST_FORWARD FOR SELECT col, seq, width, editable, required, hidden, dtype FROM @fd;
OPEN curd FETCH NEXT FROM curd INTO @c2, @s2, @w2, @e2, @r2, @h2, @d2;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_LINE_PATROL' AND col_name = @c2)
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES (N'QC_LINE_PATROL', @c2, @c2, @d2, N'detail', @s2, @w2, @e2, @r2, @h2, CASE WHEN @h2 = 1 THEN 0 ELSE 1 END);
  FETCH NEXT FROM curd INTO @c2, @s2, @w2, @e2, @r2, @h2, @d2;
END
CLOSE curd DEALLOCATE curd;
GO

/* ============ E. 角色授权(照抄 QC_OQC_REPORT 的授权口径;漏这段 = 菜单能进、点进去被路由守卫踢回登录页) ============ */
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms)
SELECT r.id,
       N'QC_LINE_PATROL',
       ISNULL(oq.can_approve, N'N'),
       ISNULL(NULLIF(oq.perms, N''), N'view,query,add,modify,modlog,del,export')
FROM yj_role r
LEFT JOIN yj_role_panel oq ON oq.role_id = r.id AND oq.panel_code = N'QC_OQC_REPORT'
WHERE NOT EXISTS (SELECT 1 FROM yj_role_panel rp WHERE rp.role_id = r.id AND rp.panel_code = N'QC_LINE_PATROL');
GO

/* ============ F. 多语言(AGENTS.md 强制:面板名 + 每个新标签 en;已有全局译名的不重复插) ============ */
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'panel' AND ref_key = N'成型车间巡线记录表' AND locale = N'en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source)
  VALUES (N'panel', N'成型车间巡线记录表', N'en', N'Forming Workshop Line Patrol Record', N'manual');
GO

DECLARE @ft TABLE (label nvarchar(50), en nvarchar(120));
INSERT INTO @ft VALUES
 (N'巡线时间',   N'Patrol Time'),
 (N'编号1',      N'No. 1'),
 (N'型号1',      N'Model 1'),
 (N'长度标准1',  N'Length Standard 1'),
 (N'长度实测1',  N'Length Measured 1'),
 (N'内径标准1',  N'ID Standard 1'),
 (N'内径实测1',  N'ID Measured 1'),
 (N'重量标准1',  N'Weight Standard 1'),
 (N'重量实测1',  N'Weight Measured 1'),
 (N'编号2',      N'No. 2'),
 (N'型号2',      N'Model 2'),
 (N'长度标准2',  N'Length Standard 2'),
 (N'长度实测2',  N'Length Measured 2'),
 (N'内径标准2',  N'ID Standard 2'),
 (N'内径实测2',  N'ID Measured 2'),
 (N'重量标准2',  N'Weight Standard 2'),
 (N'重量实测2',  N'Weight Measured 2'),
 (N'两液密度',   N'Dual-liquid Density'),
 (N'表面状态',   N'Surface Condition'),
 (N'结果判定',   N'Result Judgement'),
 (N'巡线人员',   N'Patrol Inspector');
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

/* 跌落强度/抗压强度 已有 en 行但 text 与中文标签逐字相同(历史占位,en 界面仍显示中文)——
 * 只回填「text = ref_key」的占位行(真正的译名一律不覆盖),本面板两个块级标签的 en 才算可交付。 */
DECLARE @fix TABLE (label nvarchar(50), en nvarchar(120));
INSERT INTO @fix VALUES (N'跌落强度', N'Drop Strength'), (N'抗压强度', N'Compressive Strength');
DECLARE @fl nvarchar(50), @fe nvarchar(120), @n int;
DECLARE curfix CURSOR LOCAL FAST_FORWARD FOR SELECT label, en FROM @fix;
OPEN curfix FETCH NEXT FROM curfix INTO @fl, @fe;
WHILE @@FETCH_STATUS = 0
BEGIN
  UPDATE yj_translation SET text = @fe
   WHERE scope = N'field' AND ref_key = @fl AND locale = N'en' AND text = @fl;
  SET @n = @@ROWCOUNT;
  IF @n > 0 PRINT N'[FIX] 占位译名已回填:' + @fl + N' -> ' + @fe;
  FETCH NEXT FROM curfix INTO @fl, @fe;
END
CLOSE curfix DEALLOCATE curfix;
GO

/* ============ G. 中文注明(全量部署规范:新表与逐列 MS_Description,幂等;class=1 防索引号撞列号) ============ */
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.qc_line_patrol_head') AND minor_id = 0 AND name = N'MS_Description' AND class = 1)
  EXEC sp_addextendedproperty N'MS_Description',
    N'成型车间巡线记录表头表(2026-11-14;纸面大标题「成型车间巡线记录表」,品质管理→制程品质→巡线检验;头只放单据编号/日期/审核人与状态,记录内容全在行表)',
    N'SCHEMA', N'dbo', N'TABLE', N'qc_line_patrol_head';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.qc_line_patrol_detail') AND minor_id = 0 AND name = N'MS_Description' AND class = 1)
  EXEC sp_addextendedproperty N'MS_Description',
    N'成型车间巡线记录表行表(一行 = 纸面一个「记录块」:块内 4 子行 = 产品①②的 编号/型号 + 标准值/实测值;块级列 巡线时间/车间/两液密度/表面状态/跌落强度/抗压强度/结果判定/巡线人员 在纸面 4 子行上 rowspan=4)',
    N'SCHEMA', N'dbo', N'TABLE', N'qc_line_patrol_detail';
GO

DECLARE @cols TABLE (tbl sysname, col sysname, note nvarchar(400));
INSERT INTO @cols (tbl, col, note) VALUES
 (N'qc_line_patrol_head', N'id',         N'主键(bigint IDENTITY);面板 QC_LINE_PATROL 的 pk_col'),
 (N'qc_line_patrol_head', N'单据编号',   N'单据号:号池前缀 XJ,形如 XJ-2026-11-0001(FormNoService 按 s_allno 取号)'),
 (N'qc_line_patrol_head', N'单据日期',   N'纸面「日期」;面板 date_col'),
 (N'qc_line_patrol_head', N'审核人',     N'纸面「审核人」(只读展示);审批流后续接入时落审核人'),
 (N'qc_line_patrol_head', N'审核时间',   N'审核动作时间(datetime2)'),
 (N'qc_line_patrol_head', N'单据状态',   N'单据状态:草稿/已提交/已审核(引擎通用;不设固定默认值,避免与 yj_doc_status 双真源)'),
 (N'qc_line_patrol_head', N'备注',       N'表头备注(纸面不占格,留作附注)'),
 (N'qc_line_patrol_detail', N'id',        N'主键(bigint IDENTITY)'),
 (N'qc_line_patrol_detail', N'单据编号',  N'关联头表 qc_line_patrol_head.单据编号(组键 group_col)'),
 (N'qc_line_patrol_detail', N'行号',      N'块序号(1..n):一个记录块一个号,前端发号,纸面/列表按它排序'),
 (N'qc_line_patrol_detail', N'巡线时间',  N'块级:本块的巡线时刻(纸面第 1 列)'),
 (N'qc_line_patrol_detail', N'车间',      N'块级:巡线车间(纸面第 2 列)'),
 (N'qc_line_patrol_detail', N'编号1',     N'产品①:炭棒编号(纸面「产品信息确认」列)'),
 (N'qc_line_patrol_detail', N'型号1',     N'产品①:型号(纸面「产品信息确认」列)'),
 (N'qc_line_patrol_detail', N'长度标准1', N'产品①:长度标准值(mm,纸面「炭棒长度范围mm」标准行)'),
 (N'qc_line_patrol_detail', N'长度实测1', N'产品①:长度实测值(mm,纸面标准行下方实测行)'),
 (N'qc_line_patrol_detail', N'内径标准1', N'产品①:内径标准值(mm,纸面「内径检查mm」标准行)'),
 (N'qc_line_patrol_detail', N'内径实测1', N'产品①:内径实测值(mm)'),
 (N'qc_line_patrol_detail', N'重量标准1', N'产品①:重量标准值(g,纸面「重量范围g」标准行)'),
 (N'qc_line_patrol_detail', N'重量实测1', N'产品①:重量实测值(g)'),
 (N'qc_line_patrol_detail', N'编号2',     N'产品②:炭棒编号(每块记 2 支,纸样如此)'),
 (N'qc_line_patrol_detail', N'型号2',     N'产品②:型号'),
 (N'qc_line_patrol_detail', N'长度标准2', N'产品②:长度标准值(mm)'),
 (N'qc_line_patrol_detail', N'长度实测2', N'产品②:长度实测值(mm)'),
 (N'qc_line_patrol_detail', N'内径标准2', N'产品②:内径标准值(mm)'),
 (N'qc_line_patrol_detail', N'内径实测2', N'产品②:内径实测值(mm)'),
 (N'qc_line_patrol_detail', N'重量标准2', N'产品②:重量标准值(g)'),
 (N'qc_line_patrol_detail', N'重量实测2', N'产品②:重量实测值(g)'),
 (N'qc_line_patrol_detail', N'两液密度',  N'块级:两液密度(纸面括注「伊玛印品耐水煮要求测试」)'),
 (N'qc_line_patrol_detail', N'表面状态',  N'块级:表面状态描述'),
 (N'qc_line_patrol_detail', N'跌落强度',  N'块级:跌落强度(与首件检验单/成型工艺清单同口径)'),
 (N'qc_line_patrol_detail', N'抗压强度',  N'块级:抗压强度(与首件检验单/成型工艺清单同口径)'),
 (N'qc_line_patrol_detail', N'结果判定',  N'块级:本块判定结果(合格/不合格,文本手填)'),
 (N'qc_line_patrol_detail', N'巡线人员',  N'块级:本块巡线人(纸面末列)');
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

/* ============ H. 自检(缺一即 RAISERROR 16,DbSync 判失败且不写 yj_schema_log) ============ */
DECLARE @bad int = 0;
DECLARE @msg nvarchar(500) = N'';
IF OBJECT_ID(N'dbo.qc_line_patrol_head', N'U') IS NULL BEGIN SET @bad += 1; SET @msg += N'缺头表;'; END
IF OBJECT_ID(N'dbo.qc_line_patrol_detail', N'U') IS NULL BEGIN SET @bad += 1; SET @msg += N'缺行表;'; END
IF COL_LENGTH(N'dbo.qc_line_patrol_head', N'asp_cancel') IS NULL BEGIN SET @bad += 1; SET @msg += N'头表缺 asp_cancel;'; END
IF COL_LENGTH(N'dbo.qc_line_patrol_detail', N'asp_cancel') IS NULL BEGIN SET @bad += 1; SET @msg += N'行表缺 asp_cancel;'; END
IF COL_LENGTH(N'dbo.qc_line_patrol_detail', N'重量实测2') IS NULL BEGIN SET @bad += 1; SET @msg += N'行表缺 重量实测2;'; END
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = N'QC_LINE_PATROL') BEGIN SET @bad += 1; SET @msg += N'缺面板;'; END
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'QC_LINE_PATROL' AND place LIKE N'%header%') <> 5 BEGIN SET @bad += 1; SET @msg += N'头字段数<>5;'; END
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'QC_LINE_PATROL' AND place LIKE N'%detail%') <> 25 BEGIN SET @bad += 1; SET @msg += N'明细字段数<>25;'; END
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_LINE_PATROL' AND col_name = N'行号' AND hidden = 1 AND visible = 0) BEGIN SET @bad += 1; SET @msg += N'行号未按隐藏登记;'; END
IF (SELECT COUNT(*) FROM yj_role_panel WHERE panel_code = N'QC_LINE_PATROL') = 0 BEGIN SET @bad += 1; SET @msg += N'缺角色授权;'; END
IF (SELECT COUNT(*) FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.qc_line_patrol_head') AND minor_id = 0 AND name = N'MS_Description') = 0 BEGIN SET @bad += 1; SET @msg += N'缺头表注明;'; END
IF (SELECT COUNT(*) FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.qc_line_patrol_detail') AND minor_id = 0 AND name = N'MS_Description') = 0 BEGIN SET @bad += 1; SET @msg += N'缺行表注明;'; END
IF (SELECT COUNT(*) FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.qc_line_patrol_detail') AND name = N'MS_Description' AND class = 1 AND minor_id > 0) < 27 BEGIN SET @bad += 1; SET @msg += N'行表列注明不足;'; END
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'panel' AND ref_key = N'成型车间巡线记录表' AND locale = N'en') BEGIN SET @bad += 1; SET @msg += N'缺面板 en 译名;'; END
IF (SELECT COUNT(*) FROM yj_field f WHERE f.panel_code = N'QC_LINE_PATROL'
      AND NOT EXISTS (SELECT 1 FROM yj_translation t WHERE t.scope = N'field' AND t.ref_key = f.label AND t.locale = N'en')) > 0
  BEGIN SET @bad += 1; SET @msg += N'有字段标签缺 en 译名;'; END
IF @bad > 0 RAISERROR(N'巡线检验迁移自检失败(缺表/缺面板/缺字段/缺授权/缺注明/缺译名):%s', 16, 1, @msg);
ELSE PRINT N'巡线检验就绪(QC_LINE_PATROL / qc_line_patrol_head / qc_line_patrol_detail)';
GO
