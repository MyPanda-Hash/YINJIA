/* migrate-qc-proc-insp.sql(2026-10-12):制程检验单 —— QC_PROC_INSP
 *
 * 需求来源:《生产相关品质检验.xlsx》Sheet1 第3步 +「制程检验」页签 + 用户 2026-10-12 截图四张。
 *   流程(用户口径):第2步 首件检验 / 第3步 制程检验 / 第5步 成品检验外观。
 *   用户 2026-10-12 明确:「**保留当前成型检验与切炭检验**,尝试创建制程检验」
 *     —— 故本脚本**只新增一张单**,不动 QC_MOLD_INSP / QC_CUT_INSP / QC_ASM_INSP。
 *
 * 表样(截图2「制程检验」页签,B26:U31)分两组:
 *   ① 制程检验组(3 组检验项):
 *        表头 7 列:检验时间|客户名称|产品编码|型号(mm)|批号|抽检总量|结果判断
 *        表体 3 组:外观(H:J,3 子列:端盖两头|管身两侧|按项目填充)
 *                  尺寸(K:O,5 列合并 —— 5 = 抽检量,对应 5 个测量值)
 *                  出货重量(P:T,5 列合并,同上)
 *   ② 出货检验功能性测试组(B32 起):
 *        客户名称|产品编码|型号(mm)|批号|检验人员|产线常规功能性结果|结果判断
 *        检验要求(F)|检验方法(G) —— 表头写明「以下检验要求/方法**自动填充出货检验计划表**」
 *      → 本组用「表区」= 功能性测试 区分,与制程检验组同表不同区。
 *
 * 「表区」口径(沿用三张工序检验单已有的列,不新增列):
 *   外观 / 尺寸 / 重量 / 功能性测试   ← 本单新增的四个值
 *   (既有两值 检验项目 / 数量判定 仍被 QC_MOLD_INSP 等使用,互不影响)
 *
 * 标准来源(不在本脚本,由业务在界面录入):
 *   出货检验计划表 RD_INSP_PLAN —— 检测频率 = 「1PCS/一个生产批次」的行 = 制程检验要检的项。
 *   本脚本只建载体;「报工审核 → 自动带出明细」的代码改动见方案文档 §4.3 第 3 步。
 *
 * 规范符合性(数据库规范 §1.1/§2.1):qc_ 前缀 = 品质管理单据,头行成对;
 *   主键 id + 审计四件套 asp_user1/2 + asp_time1/2;asp_cancel nvarchar(1) 默认 'N';
 *   表与关键列均写 MS_Description 中文注明(全量部署规范)。
 * 幂等:建表 IF OBJECT_ID IS NULL、字段 INSERT 走 NOT EXISTS、注明 IF NOT EXISTS;两账套均执行。
 */

/* ============ A. 建表 ============ */
IF OBJECT_ID(N'dbo.qc_proc_insp_head', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.qc_proc_insp_head (
    id           bigint IDENTITY(1,1) NOT NULL CONSTRAINT pk_qc_proc_insp_head PRIMARY KEY,
    单据编号     nvarchar(50)  NOT NULL,
    单据日期     date          NULL,
    检验时间     nvarchar(30)  NULL,   /* 截图2 首列:可与单据日期不同(实际取样时刻) */
    检验类别     nvarchar(20)  NULL,   /* 首件检验 / 制程检验(截图 Sheet1 第2、3步) */
    工单号       nvarchar(50)  NULL,
    工单行号     int           NULL,
    报工单号     nvarchar(50)  NULL,
    工序         nvarchar(50)  NULL,
    批次号       nvarchar(50)  NULL,
    客户名称     nvarchar(200) NULL,   /* 截图2 第2列;检验单头原本没有,本单新增 */
    产品编码     nvarchar(50)  NULL,
    产品名称     nvarchar(200) NULL,
    规格型号     nvarchar(200) NULL,   /* 截图2「型号(mm)」 */
    生产线       nvarchar(50)  NULL,
    生产车间     nvarchar(50)  NULL,
    报工数量     decimal(18,4) NULL,
    抽检总量     decimal(18,4) NULL,   /* 截图2 第6列(截图样例写"手动录入") */
    检验数量     decimal(18,4) NULL,
    检验员       nvarchar(50)  NULL,
    检验日期     date          NULL,
    总结论       nvarchar(20)  NULL,   /* 截图2 末列「结果判断」:合格/不合格 */
    检验方案     nvarchar(100) NULL,   /* 参照 QC_PLAN.方案名称(与三张工序检验单同口径) */
    文件编码     nvarchar(100) NULL,
    执行标准     nvarchar(200) NULL,
    处理方式     nvarchar(50)  NULL,
    备注         nvarchar(500) NULL,
    单据状态     nvarchar(20)  NULL,
    审核人       nvarchar(50)  NULL,
    审核时间     datetime2     NULL,
    asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL,
    asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL,
    asp_cancel nvarchar(1) NULL CONSTRAINT df_qc_proc_insp_head_cancel DEFAULT (N'N')
  );
  PRINT N'[OK] qc_proc_insp_head 已建';
END
ELSE PRINT N'[SKIP] qc_proc_insp_head 已存在';
GO

IF OBJECT_ID(N'dbo.qc_proc_insp_detail', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.qc_proc_insp_detail (
    id           bigint IDENTITY(1,1) NOT NULL CONSTRAINT pk_qc_proc_insp_detail PRIMARY KEY,
    单据编号     nvarchar(50)  NOT NULL,
    表区         nvarchar(20)  NULL,   /* 外观 / 尺寸 / 重量 / 功能性测试 */
    行号         int           NULL,
    检验项目     nvarchar(100) NULL,
    检验要求     nvarchar(500) NULL,   /* 截图「检验要求」;与三张单的「标准要求」同义,本单按截图用词 */
    检验方法     nvarchar(1000) NULL,  /* 截图3「检验方法」 */
    抽检量       decimal(18,4) NULL,
    实测数值     nvarchar(500) NULL,   /* 尺寸/重量可存多个值,如 44.5/44.6/44.5/44.7/44.6 */
    单项判定     nvarchar(20)  NULL,   /* 截图「判定」;本单按截图用词 */
    不合格应对措施 nvarchar(500) NULL, /* 截图4 出货检验计划表的列,随标准带入 */
    结果判断     nvarchar(20)  NULL,   /* 截图2/3 的「结果判断」列(功能性测试组用) */
    处理方式     nvarchar(50)  NULL,
    备注         nvarchar(200) NULL,
    asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL,
    asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL,
    asp_cancel nvarchar(1) NULL CONSTRAINT df_qc_proc_insp_detail_cancel DEFAULT (N'N')
  );
  PRINT N'[OK] qc_proc_insp_detail 已建';
END
ELSE PRINT N'[SKIP] qc_proc_insp_detail 已存在';
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_qc_proc_insp_head_no' AND object_id = OBJECT_ID(N'dbo.qc_proc_insp_head'))
  CREATE INDEX ix_qc_proc_insp_head_no ON dbo.qc_proc_insp_head (单据编号, 报工单号);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_qc_proc_insp_detail_no' AND object_id = OBJECT_ID(N'dbo.qc_proc_insp_detail'))
  CREATE INDEX ix_qc_proc_insp_detail_no ON dbo.qc_proc_insp_detail (单据编号, 表区);
GO

/* ============ B. 面板登记 ============ */
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = N'QC_PROC_INSP')
  INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group)
  VALUES (N'QC_PROC_INSP', N'制程检验单', N'生产管理', 'doc', N'qc_proc_insp_detail', N'qc_proc_insp_head',
          N'单据编号', N'id', N'单据编号', N'ZC', N'单据日期', 20, N'items', N'生产制造');
GO

/* ============ C. 字段登记(头) ============ */
DECLARE @fh TABLE (col nvarchar(50), place nvarchar(30), seq int, width int, editable int, required int);
INSERT INTO @fh VALUES
 (N'单据编号',   N'query,header',  10, 140, 0, 1),
 (N'单据日期',   N'query,header',  20, 110, 1, 1),
 (N'检验时间',   N'query,header',  30, 140, 1, 0),
 (N'检验类别',   N'query,header',  40, 100, 1, 0),
 (N'工单号',     N'query,header',  50, 140, 1, 0),
 (N'报工单号',   N'query,header',  60, 140, 1, 0),
 (N'工序',       N'query,header',  70, 90,  1, 0),
 (N'批次号',     N'query,header',  80, 110, 1, 0),
 (N'客户名称',   N'query,header',  90, 180, 1, 0),
 (N'产品编码',   N'query,header', 100, 120, 1, 0),
 (N'产品名称',   N'query,header', 110, 180, 1, 0),
 (N'规格型号',   N'header',       120, 160, 1, 0),
 (N'生产线',     N'header',       130, 110, 1, 0),
 (N'生产车间',   N'header',       140, 110, 1, 0),
 (N'报工数量',   N'header',       150, 100, 1, 0),
 (N'抽检总量',   N'header',       160, 100, 1, 0),
 (N'检验数量',   N'header',       170, 100, 1, 0),
 (N'检验员',     N'query,header', 180, 100, 1, 0),
 (N'检验日期',   N'header',       190, 110, 1, 0),
 (N'总结论',     N'query,header', 200, 100, 1, 0),
 (N'检验方案',   N'header',       210, 160, 1, 0),
 (N'文件编码',   N'header',       220, 120, 1, 0),
 (N'执行标准',   N'header',       230, 200, 1, 0),
 (N'处理方式',   N'header,detail',240, 120, 1, 0),
 (N'备注',       N'header,detail',250, 200, 1, 0),
 (N'单据状态',   N'query,header', 260, 90,  0, 0),
 (N'审核人',     N'header',       270, 90,  0, 0),
 (N'审核时间',   N'header',       280, 140, 0, 0);
DECLARE @c nvarchar(50), @p nvarchar(30), @s int, @w int, @e int, @r int;
DECLARE curf CURSOR LOCAL FAST_FORWARD FOR SELECT col, place, seq, width, editable, required FROM @fh;
OPEN curf FETCH NEXT FROM curf INTO @c, @p, @s, @w, @e, @r;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_PROC_INSP' AND col_name = @c)
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES (N'QC_PROC_INSP', @c, @c, N'文本', @p, @s, @w, @e, @r, 0, 1);
  FETCH NEXT FROM curf INTO @c, @p, @s, @w, @e, @r;
END
CLOSE curf DEALLOCATE curf;
GO

/* ============ D. 字段登记(明细) ============ */
DECLARE @fd TABLE (col nvarchar(50), seq int, width int, editable int, required int);
INSERT INTO @fd VALUES
 (N'表区',         10,  100, 1, 0),
 (N'行号',         20,  70,  0, 0),
 (N'检验项目',     30,  160, 1, 0),
 (N'检验要求',     40,  240, 1, 0),
 (N'检验方法',     50,  300, 1, 0),
 (N'抽检量',       60,  90,  1, 0),
 (N'实测数值',     70,  180, 1, 0),
 (N'单项判定',     80,  90,  1, 0),
 (N'不合格应对措施', 90, 200, 1, 0),
 (N'结果判断',     100, 100, 1, 0),
 (N'处理方式',     110, 120, 1, 0),
 (N'备注',         120, 180, 1, 0);
DECLARE @c2 nvarchar(50), @s2 int, @w2 int, @e2 int, @r2 int;
DECLARE curd CURSOR LOCAL FAST_FORWARD FOR SELECT col, seq, width, editable, required FROM @fd;
OPEN curd FETCH NEXT FROM curd INTO @c2, @s2, @w2, @e2, @r2;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_PROC_INSP' AND col_name = @c2)
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES (N'QC_PROC_INSP', @c2, @c2, N'文本', N'detail', @s2, @w2, @e2, @r2, 0, 1);
  FETCH NEXT FROM curd INTO @c2, @s2, @w2, @e2, @r2;
END
CLOSE curd DEALLOCATE curd;
GO

/* 抽检量/行号 改数值类型(便于合计与排序) */
UPDATE yj_field SET data_type = N'小数' WHERE panel_code = N'QC_PROC_INSP' AND col_name = N'抽检量' AND data_type <> N'小数';
UPDATE yj_field SET data_type = N'整数' WHERE panel_code = N'QC_PROC_INSP' AND col_name = N'行号'   AND data_type <> N'整数';
GO

/* ============ E. 角色授权 ============ */
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms)
SELECT r.id, N'QC_PROC_INSP', N'N', N'view,query,add,modify,modlog,del,export'
FROM yj_role r
WHERE NOT EXISTS (SELECT 1 FROM yj_role_panel rp WHERE rp.role_id = r.id AND rp.panel_code = N'QC_PROC_INSP');
GO

/* ============ F. 多语言(AGENTS.md 强制:新面板 + 新字段至少 en) ============ */
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'panel' AND ref_key = N'制程检验单' AND locale = N'en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source)
  VALUES (N'panel', N'制程检验单', N'en', N'In-Process Inspection Sheet', N'manual');

DECLARE @ft TABLE (label nvarchar(50), en nvarchar(100));
INSERT INTO @ft VALUES
 (N'制程检验单',   N'In-Process Inspection Sheet'),
 (N'检验时间',     N'Inspection Time'),
 (N'检验类别',     N'Inspection Type'),
 (N'客户名称',     N'Customer'),
 (N'抽检总量',     N'Sample Total Qty'),
 (N'抽检量',       N'Sample Qty'),
 (N'表区',         N'Section'),
 (N'检验要求',     N'Inspection Requirement'),
 (N'单项判定',     N'Item Judgement'),
 (N'不合格应对措施', N'Nonconformance Action'),
 (N'结果判断',     N'Result Judgement'),
 (N'首件检验',     N'First Article Inspection'),
 (N'制程检验',     N'In-Process Inspection'),
 (N'外观',         N'Appearance'),
 (N'尺寸',         N'Dimensions'),
 (N'重量',         N'Weight'),
 (N'功能性测试',   N'Functional Test');
DECLARE @lb nvarchar(50), @en nvarchar(100);
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
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.qc_proc_insp_head') AND minor_id = 0 AND name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description',
    N'制程检验单头表(2026-10-12:按《生产相关品质检验.xlsx》第3步制程检验建;报工审核可自动生成;检验类别区分 首件检验/制程检验)',
    N'SCHEMA', N'dbo', N'TABLE', N'qc_proc_insp_head';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.qc_proc_insp_detail') AND minor_id = 0 AND name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description',
    N'制程检验单行表(表区=外观/尺寸/重量/功能性测试 四组;尺寸与重量的实测数值可含多个抽样值,如 44.5/44.6/44.5/44.7/44.6)',
    N'SCHEMA', N'dbo', N'TABLE', N'qc_proc_insp_detail';
GO

/* 列级注明:逐列(幂等) */
DECLARE @cols TABLE (tbl sysname, col sysname, note nvarchar(400));
INSERT INTO @cols (tbl, col, note) VALUES
 (N'qc_proc_insp_head', N'检验类别', N'首件检验 / 制程检验(对应流程第2、3步)'),
 (N'qc_proc_insp_head', N'检验时间', N'实际取样时刻(可与单据日期不同)'),
 (N'qc_proc_insp_head', N'客户名称', N'截图「制程检验」表第2列;由工单客户带入'),
 (N'qc_proc_insp_head', N'规格型号', N'截图「型号(mm)」'),
 (N'qc_proc_insp_head', N'抽检总量', N'截图「抽检总量」列(界面手动录入)'),
 (N'qc_proc_insp_head', N'总结论', N'截图「结果判断」列:合格/不合格'),
 (N'qc_proc_insp_head', N'检验方案', N'参照 bs_qc_plan.方案名称(与三张工序检验单同口径)'),
 (N'qc_proc_insp_detail', N'表区', N'外观 / 尺寸 / 重量 / 功能性测试(报表按此分段渲染)'),
 (N'qc_proc_insp_detail', N'检验要求', N'截图「检验要求」;来源=出货检验计划表 RD_INSP_PLAN.控制标准及要求'),
 (N'qc_proc_insp_detail', N'检验方法', N'截图「检验方法」;来源=出货检验计划表 RD_INSP_PLAN.控制方法'),
 (N'qc_proc_insp_detail', N'实测数值', N'尺寸/重量可存多个抽样值(如 44.5/44.6/44.5/44.7/44.6)'),
 (N'qc_proc_insp_detail', N'单项判定', N'截图「判定」:合格/不合格'),
 (N'qc_proc_insp_detail', N'不合格应对措施', N'来源=出货检验计划表 RD_INSP_PLAN.不合格应对措施'),
 (N'qc_proc_insp_detail', N'结果判断', N'截图「结果判断」列(功能性测试组用)');
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

/* ============ H. 自检 ============ */
DECLARE @bad int = 0;
IF OBJECT_ID(N'dbo.qc_proc_insp_head', N'U') IS NULL SET @bad = @bad + 1;
IF OBJECT_ID(N'dbo.qc_proc_insp_detail', N'U') IS NULL SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = N'QC_PROC_INSP') SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'QC_PROC_INSP' AND place LIKE N'%header%') < 20 SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'QC_PROC_INSP' AND place LIKE N'%detail%') < 12 SET @bad = @bad + 1;
/* 必备列:pk_col 与 asp_cancel(体检 13 项口径) */
IF COL_LENGTH(N'dbo.qc_proc_insp_head', N'asp_cancel') IS NULL SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.qc_proc_insp_detail', N'asp_cancel') IS NULL SET @bad = @bad + 1;
/* 表级中文注明 */
IF (SELECT COUNT(*) FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.qc_proc_insp_head') AND minor_id = 0 AND name = N'MS_Description') = 0 SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.qc_proc_insp_detail') AND minor_id = 0 AND name = N'MS_Description') = 0 SET @bad = @bad + 1;
/* 面板译名 */
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'panel' AND ref_key = N'制程检验单' AND locale = N'en') SET @bad = @bad + 1;
IF @bad > 0 RAISERROR(N'制程检验单迁移自检失败(缺表/缺面板/缺字段/缺注明/缺译名)', 16, 1);
ELSE PRINT N'制程检验单就绪(QC_PROC_INSP / qc_proc_insp_head / qc_proc_insp_detail)';
GO
