/* migrate-qc-process-insp.sql(2026-10-05):三类工序检验单 —— 9.29 生产管理批次 ④
 *
 * 会议口径:「成型、切断(切炭)、组装**报工时各自自动生成一张检验单**(三张独立,不合并 —— 格式都不一样)」;
 *   组装成品检验单功能最全:「录入合格/不合格数量(各一行),合格数转库存、不合格数留系统待处理;
 *   品质不实际检验时单据也要走过」;成型/切炭「先按通用模板做触发和流转,品质提供格式后替换模板」。
 *
 * 三张面板(独立,不合并):
 *   · QC_MOLD_INSP 成型检验单   —— qc_mold_insp_head / qc_mold_insp_detail(前缀 CX)
 *   · QC_CUT_INSP  切炭检验单   —— qc_cut_insp_head  / qc_cut_insp_detail (前缀 QT)
 *   · QC_ASM_INSP  组装成品检验单 —— qc_asm_insp_head / qc_asm_insp_detail (前缀 ZJ)
 * 表规范(数据库规范 §1.1/§2.1):qc_ 前缀 = 品质管理单据,头行成对;主键 + 审计四件套;asp_cancel nvarchar(1)。
 * 三张表列集一致(便于统一维护):头 21 列 + 行 9 列 + 审计四件套 + asp_cancel。
 *   成型/切炭先用通用模板(明细:检验项目/标准要求/实测数值/判定);
 *   组装成品用同一模板的扩展位(明细另有 数量 + 处理方式 = 合格/不合格各一行、合格转库存/不合格待处理)。
 *
 * 触发与流转由 WoInspectionService 负责(报工单审核自动出单、弃审自动作废草稿单、组装审核后
 * 合格数转产成品入库草稿 + 不合格数转不良品处理草稿)。幂等可重跑;两账套均执行。
 */

/* ============ A. 建表(3 组 head/detail,列集一致) ============ */
DECLARE @panels TABLE (code sysname, tbl sysname, cn nvarchar(50), prefix nvarchar(10));
INSERT INTO @panels VALUES
 (N'MOLD', N'qc_mold_insp', N'成型检验单',     N'CX'),
 (N'CUT',  N'qc_cut_insp',  N'切炭检验单',     N'QT'),
 (N'ASM',  N'qc_asm_insp',  N'组装成品检验单', N'ZJ');

DECLARE @tbl sysname, @cn nvarchar(50), @sql nvarchar(max);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT tbl, cn FROM @panels;
OPEN cur FETCH NEXT FROM cur INTO @tbl, @cn;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF OBJECT_ID(N'dbo.' + @tbl + N'_head') IS NULL
  BEGIN
    SET @sql = N'CREATE TABLE dbo.' + @tbl + N'_head ('
      + N' id bigint IDENTITY(1,1) NOT NULL CONSTRAINT pk_' + @tbl + N'_head PRIMARY KEY,'
      + N' 单据编号 nvarchar(50) NOT NULL,'
      + N' 单据日期 date NULL,'
      + N' 工单号 nvarchar(50) NULL,'
      + N' 批次号 nvarchar(50) NULL,'
      + N' 报工单号 nvarchar(50) NULL,'
      + N' 工序 nvarchar(50) NULL,'
      + N' 产品编码 nvarchar(50) NULL,'
      + N' 产品名称 nvarchar(200) NULL,'
      + N' 规格型号 nvarchar(200) NULL,'
      + N' 生产线 nvarchar(50) NULL,'
      + N' 生产车间 nvarchar(50) NULL,'
      + N' 报工数量 decimal(18,4) NULL,'
      + N' 检验数量 decimal(18,4) NULL,'
      + N' 检验员 nvarchar(50) NULL,'
      + N' 检验日期 date NULL,'
      + N' 总结论 nvarchar(20) NULL,'
      + N' 处理方式 nvarchar(50) NULL,'
      + N' 备注 nvarchar(500) NULL,'
      + N' 审核人 nvarchar(50) NULL,'
      + N' 审核时间 datetime2 NULL,'
      + N' asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL,'
      + N' asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL,'
      + N' asp_cancel nvarchar(1) NULL CONSTRAINT df_' + @tbl + N'_head_cancel DEFAULT (N''N''))';
    EXEC sp_executesql @sql;
  END
  IF OBJECT_ID(N'dbo.' + @tbl + N'_detail') IS NULL
  BEGIN
    SET @sql = N'CREATE TABLE dbo.' + @tbl + N'_detail ('
      + N' id bigint IDENTITY(1,1) NOT NULL CONSTRAINT pk_' + @tbl + N'_detail PRIMARY KEY,'
      + N' 单据编号 nvarchar(50) NOT NULL,'
      + N' 行号 int NULL,'
      + N' 检验项目 nvarchar(100) NULL,'
      + N' 标准要求 nvarchar(200) NULL,'
      + N' 实测数值 nvarchar(100) NULL,'
      + N' 判定 nvarchar(20) NULL,'
      + N' 数量 decimal(18,4) NULL,'
      + N' 处理方式 nvarchar(50) NULL,'
      + N' 备注 nvarchar(200) NULL,'
      + N' asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL,'
      + N' asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL,'
      + N' asp_cancel nvarchar(1) NULL CONSTRAINT df_' + @tbl + N'_detail_cancel DEFAULT (N''N''))';
    EXEC sp_executesql @sql;
  END
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_' + @tbl + N'_head_no' AND object_id = OBJECT_ID(N'dbo.' + @tbl + N'_head'))
    SET @sql = N'CREATE INDEX ix_' + @tbl + N'_head_no ON dbo.' + @tbl + N'_head (单据编号, 报工单号)';
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_' + @tbl + N'_head_no' AND object_id = OBJECT_ID(N'dbo.' + @tbl + N'_head'))
    EXEC sp_executesql @sql;
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_' + @tbl + N'_detail_no' AND object_id = OBJECT_ID(N'dbo.' + @tbl + N'_detail'))
  BEGIN
    SET @sql = N'CREATE INDEX ix_' + @tbl + N'_detail_no ON dbo.' + @tbl + N'_detail (单据编号)';
    EXEC sp_executesql @sql;
  END
  /* 单据状态:列表页按字段登记直接 SELECT 该列(与 qc_op/qc_insp 同口径,状态活值另存 yj_doc_status) */
  IF COL_LENGTH(N'dbo.' + @tbl + N'_head', N'单据状态') IS NULL
  BEGIN
    SET @sql = N'ALTER TABLE dbo.' + @tbl + N'_head ADD 单据状态 nvarchar(20) NULL';
    EXEC sp_executesql @sql;
  END
  FETCH NEXT FROM cur INTO @tbl, @cn;
END
CLOSE cur DEALLOCATE cur;
GO

/* ============ B. 面板登记(yj_panel)+ 字段登记(yj_field) ============ */
DECLARE @panels TABLE (code nvarchar(30), tbl sysname, cn nvarchar(50), prefix nvarchar(10));
INSERT INTO @panels VALUES
 (N'QC_MOLD_INSP', N'qc_mold_insp', N'成型检验单',     N'CX'),
 (N'QC_CUT_INSP',  N'qc_cut_insp',  N'切炭检验单',     N'QT'),
 (N'QC_ASM_INSP',  N'qc_asm_insp',  N'组装成品检验单', N'ZJ');

DECLARE @code nvarchar(30), @tbl sysname, @cn nvarchar(50), @prefix nvarchar(10);
DECLARE curp CURSOR LOCAL FAST_FORWARD FOR SELECT code, tbl, cn, prefix FROM @panels;
OPEN curp FETCH NEXT FROM curp INTO @code, @tbl, @cn, @prefix;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = @code)
    INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group)
    VALUES (@code, @cn, N'生产管理', 'doc', @tbl + N'_detail', @tbl + N'_head', N'单据编号', N'id', N'单据编号', @prefix, N'单据日期', 20, 'items', N'生产制造');

  /* 头字段:通用模板(三张一致) */
  DECLARE @fh TABLE (col nvarchar(50), place nvarchar(30), seq int, width int, editable int, required int);
  INSERT INTO @fh VALUES
   (N'单据编号', N'query,header', 10, 140, 0, 1),
   (N'单据日期', N'query,header', 20, 110, 1, 1),
   (N'工单号',   N'query,header', 30, 140, 1, 1),
   (N'报工单号', N'query,header', 40, 140, 1, 0),
   (N'工序',     N'query,header', 50, 90,  1, 0),
   (N'批次号',   N'query,header', 60, 110, 1, 0),
   (N'产品编码', N'query,header', 70, 120, 1, 0),
   (N'产品名称', N'query,header', 80, 180, 1, 0),
   (N'规格型号', N'header',       90, 160, 1, 0),
   (N'生产线',   N'query,header', 100, 110, 1, 0),
   (N'生产车间', N'header',       110, 110, 1, 0),
   (N'报工数量', N'header',       120, 100, 1, 0),
   (N'检验数量', N'header',       130, 100, 1, 0),
   (N'检验员',   N'query,header', 140, 100, 1, 0),
   (N'检验日期', N'header',       150, 110, 1, 0),
   (N'总结论',   N'query,header', 160, 100, 1, 0),
   (N'处理方式', N'header,detail', 170, 120, 1, 0),
   (N'备注',     N'header,detail',180, 200, 1, 0),
   (N'单据状态', N'query,header', 190, 90,  0, 0),
   (N'审核人',   N'header',       200, 90,  0, 0),
   (N'审核时间', N'header',       210, 140, 0, 0);
  DECLARE @c nvarchar(50), @p nvarchar(30), @s int, @w int, @e int, @r int;
  DECLARE curf CURSOR LOCAL FAST_FORWARD FOR SELECT col, place, seq, width, editable, required FROM @fh;
  OPEN curf FETCH NEXT FROM curf INTO @c, @p, @s, @w, @e, @r;
  WHILE @@FETCH_STATUS = 0
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = @code AND col_name = @c)
      INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
      VALUES (@code, @c, @c, N'文本', @p, @s, @w, @e, @r, 0, 1);
    FETCH NEXT FROM curf INTO @c, @p, @s, @w, @e, @r;
  END
  CLOSE curf DEALLOCATE curf;

  /* 明细字段:通用模板(检验项目/标准要求/实测数值/判定)+ 组装用扩展位(数量/处理方式) */
  DECLARE @fd TABLE (col nvarchar(50), seq int, width int, editable int, required int);
  INSERT INTO @fd VALUES
   (N'行号',    200, 70,  0, 0),
   (N'检验项目', 210, 160, 1, 0),
   (N'标准要求', 220, 180, 1, 0),
   (N'实测数值', 230, 120, 1, 0),
   (N'判定',    240, 90,  1, 0),
   (N'数量',    250, 100, 1, 0),
   (N'处理方式', 260, 120, 1, 0),
   (N'备注',    270, 180, 1, 0);
  DECLARE curd CURSOR LOCAL FAST_FORWARD FOR SELECT col, seq, width, editable, required FROM @fd;
  OPEN curd FETCH NEXT FROM curd INTO @c, @s, @w, @e, @r;
  WHILE @@FETCH_STATUS = 0
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = @code AND col_name = @c)
      INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
      VALUES (@code, @c, @c, N'文本', N'detail', @s, @w, @e, @r, 0, 1);
    FETCH NEXT FROM curd INTO @c, @s, @w, @e, @r;
  END
  CLOSE curd DEALLOCATE curd;

  /* 面板译名(biz:至少 en) */
  IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'panel' AND ref_key = @cn AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES
      ('panel', @cn, 'en', CASE @code
        WHEN N'QC_MOLD_INSP' THEN N'Molding Inspection Sheet'
        WHEN N'QC_CUT_INSP'  THEN N'Carbon-Cutting Inspection Sheet'
        ELSE N'Assembly Finished-Goods Inspection Sheet' END, 'manual');
  /* 角色授权:每个已有角色给标准词表(管理员另有 is_admin 豁免) */
  INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms)
  SELECT r.id, @code, N'N', N'view,query,add,modify,modlog,del,export'
  FROM yj_role r
  WHERE NOT EXISTS (SELECT 1 FROM yj_role_panel rp WHERE rp.role_id = r.id AND rp.panel_code = @code);

  FETCH NEXT FROM curp INTO @code, @tbl, @cn, @prefix;
END
CLOSE curp DEALLOCATE curp;
GO

/* 明细侧共用的两个标签(备注/处理方式)头行同名:上面「已存在则跳过」让明细那两行没插进来,
   这里把 处理方式 提升为「header,detail」(备注 在头字段里已是 header,detail),补齐后再补明细行 */
UPDATE yj_field SET place = N'header,detail'
 WHERE panel_code IN (N'QC_MOLD_INSP', N'QC_CUT_INSP', N'QC_ASM_INSP')
   AND col_name = N'处理方式' AND place = N'header';
GO

/* 字段译名(新增标签:至少 en;已有同名的跳过) */
DECLARE @ft TABLE (label nvarchar(50), en nvarchar(100));
INSERT INTO @ft VALUES
 (N'成型检验单', N'Molding Inspection Sheet'), (N'切炭检验单', N'Carbon-Cutting Inspection Sheet'),
 (N'组装成品检验单', N'Assembly Finished-Goods Inspection Sheet'),
 (N'报工单号', N'Reporting No.'), (N'报工数量', N'Reported Qty'), (N'检验数量', N'Inspection Qty'),
 (N'检验项目', N'Inspection Item'), (N'标准要求', N'Standard'), (N'实测数值', N'Measured'),
 (N'判定', N'Judgement'), (N'总结论', N'Conclusion'), (N'处理方式', N'Disposition'),
 (N'生产线', N'Production Line'), (N'生产车间', N'Workshop'), (N'工序', N'Process'),
 (N'检验员', N'Inspector'), (N'检验日期', N'Inspection Date');
DECLARE @lb nvarchar(50), @en nvarchar(100);
DECLARE curt CURSOR LOCAL FAST_FORWARD FOR SELECT label, en FROM @ft;
OPEN curt FETCH NEXT FROM curt INTO @lb, @en;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = @lb AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', @lb, 'en', @en, 'manual');
  FETCH NEXT FROM curt INTO @lb, @en;
END
CLOSE curt DEALLOCATE curt;
GO

/* ============ C. 中文注明(全量部署规范:新表与关键列必须带 MS_Description) ============ */
DECLARE @panels3 TABLE (tbl sysname, cn nvarchar(50));
INSERT INTO @panels3 VALUES
 (N'qc_mold_insp', N'成型检验单'), (N'qc_cut_insp', N'切炭检验单'), (N'qc_asm_insp', N'组装成品检验单');
DECLARE @t sysname, @n nvarchar(50), @th sysname, @td sysname, @cmt nvarchar(300);
DECLARE curc CURSOR LOCAL FAST_FORWARD FOR SELECT tbl, cn FROM @panels3;
OPEN curc FETCH NEXT FROM curc INTO @t, @n;
WHILE @@FETCH_STATUS = 0
BEGIN
  /* ⚠ sp_addextendedproperty 的参数**必须是变量**,不能写表达式(@t + N'_head' / @n + N'…') */
  SET @th = @t + N'_head';
  SET @td = @t + N'_detail';
  SET @cmt = @n + N'头表(9.29 批次④:报工审核自动生成,一工序一单)';
  IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.' + @th) AND minor_id = 0 AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', @cmt, N'SCHEMA', N'dbo', N'TABLE', @th;
  SET @cmt = @n + N'行表(检验项目/标准/实测/判定;组装成品另有 数量+处理方式)';
  IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.' + @td) AND minor_id = 0 AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', @cmt, N'SCHEMA', N'dbo', N'TABLE', @td;
  FETCH NEXT FROM curc INTO @t, @n;
END
CLOSE curc DEALLOCATE curc;
GO

/* ============ E. 前置修复:WO_REPORT 面板 code_col 指向不存在的列 ============
   2026-09-27「报工单表化(scjl)」迁移把面板的 line_table 换成了 scjl、yj_field 的单号列也改成
   「报工单号」,但漏改 yj_panel.code_col(仍是从前双表版 wo_report 的「单据编号」)。
   后果:报工单**保存**直接报 `Invalid column name '单据编号'`(scjl 无此列)—— 三类检验单的触发
   挂在报工审核上,这一条不通则整条链不通,故在本迁移内一并修掉(元数据对齐物理列)。 */
UPDATE yj_panel SET code_col = N'报工单号'
 WHERE panel_code = N'WO_REPORT' AND ISNULL(code_col, N'') <> N'报工单号';
GO

/* ============ D. 自检 ============ */
DECLARE @bad int = 0;
IF OBJECT_ID('dbo.qc_mold_insp_head') IS NULL OR OBJECT_ID('dbo.qc_mold_insp_detail') IS NULL SET @bad = @bad + 1;
IF OBJECT_ID('dbo.qc_cut_insp_head')  IS NULL OR OBJECT_ID('dbo.qc_cut_insp_detail')  IS NULL SET @bad = @bad + 1;
IF OBJECT_ID('dbo.qc_asm_insp_head')  IS NULL OR OBJECT_ID('dbo.qc_asm_insp_detail')  IS NULL SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_panel WHERE panel_code IN (N'QC_MOLD_INSP', N'QC_CUT_INSP', N'QC_ASM_INSP')) < 3 SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'QC_ASM_INSP') < 25 SET @bad = @bad + 1;
/* 前置修复自检:WO_REPORT.code_col 必须指向 scjl 上真实存在的列 */
IF NOT EXISTS (SELECT 1 FROM yj_panel p JOIN sys.columns c ON c.object_id = OBJECT_ID(N'dbo.scjl') AND c.name = p.code_col
               WHERE p.panel_code = N'WO_REPORT') SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM sysobjects WHERE name IN (N'qc_mold_insp_head', N'qc_mold_insp_detail', N'qc_cut_insp_head', N'qc_cut_insp_detail', N'qc_asm_insp_head', N'qc_asm_insp_detail')
      AND (SELECT COUNT(*) FROM sys.extended_properties ep WHERE ep.major_id = sysobjects.id AND ep.minor_id = 0 AND ep.name = N'MS_Description') = 0) > 0 SET @bad = @bad + 1;
IF @bad > 0 RAISERROR(N'三类工序检验单迁移自检失败(缺表/缺面板/缺字段/缺注明)', 16, 1);
ELSE PRINT N'三类工序检验单就绪(QC_MOLD_INSP / QC_CUT_INSP / QC_ASM_INSP)';
GO
