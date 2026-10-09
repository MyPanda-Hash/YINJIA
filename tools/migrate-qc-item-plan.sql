-- ════════════════════════════════════════════════════════════════════════════════════════
-- migrate-qc-item-plan.sql — 检验项目/检验方案落地 + 三类工序检验单按产品带出检验项
--   2026-10-09 用户口径:「参考 YJ-Q-125,把这种检验项目放入到当前组装成品检验里面」
-- ════════════════════════════════════════════════════════════════════════════════════════
-- 【依据】受控文件《YJ-Q-125 Y料原料及成品检验规范 A0》(用户提供 .doc,原件与结构 dump 见
--   tools/archive/_yq125/):
--     §4    取样:每 50kg 原料/成品各取样 1 个,每个样品 200g
--     §6.1  原料 Y-CAS-23:性能(称料 40g,余氯去除率≥80%)+ 卫生安全(称料 10g,11 项重金属增加量限值)
--     §6.2  成品 CAS-18:目数(称料 100g,+20目≤15%、-325目≤10%;20目/325目筛网震动筛分 5min)
--     §7.1  原料不合格 → 退货
--     §7.2  成品合格 → 入库;不合格 → 重新筛分
--
-- 【模型口径】(为什么这么落)
--   1) 主数据走**已存在的结构化档案**,不新造表:
--        bs_qc_plan 检验方案(头)= 适用存货/类别 + 检验方式/抽检比例 + 取样规则 + 文件编码/执行标准;
--        bs_qc_item 检验项目(行)= 项目编码/名称 + 检验内容/标准 + 判定规则 + 上下限 + 取样要求/检验方法 + 处置;
--        ★ 本次给 bs_qc_item 加 **方案编码 + 序号** ⇒ 「方案 1..N 项目」(子表带外键的经典形态,
--          不新建关联表 —— 省掉一张表的在册登记/注明/清单维护)。
--      两表此前是**空表**(bs_qc_item 0 行 / bs_qc_plan 0 行),面板 QC_ITEM/QC_PLAN 已在册(基础设置)。
--   2) 检验单明细分**两个表区**(沿用本仓库 RD_ASM_PROC 的「表区」分块先例,CONTEXT.md 记着
--      「并入共用行表必须挂表区,否则新增行以 NULL 存进去下次打不开」的教训):
--        表区='检验项目' → 检验项目/标准要求/检验方法/实测数值/判定  (YJ-Q-125 带出来的那些行)
--        表区='数量判定' → 判定(合格/不合格)/数量/处理方式          (组装成品现状那两行,**原样保留**)
--      ⇒ ButtonService.asmInspToStock 的「合格数转库存/不合格数待处理」**一行代码都不用改**。
--   3) 建单侧:三类工序检验单(成型/切炭/组装)生成时按**工单产品**匹配方案带出项目行;
--      **匹配不到就维持现状**(通用模板行),存量单与未建档产品零影响。
--   4) 只加列/登记字段/播种真数据;不动任何存量单据、不动库存与分流逻辑。
--
-- 【幂等】全部 CREATE 走 COL_LENGTH/OBJECT_ID/NOT EXISTS 守卫;播种按 项目编码/方案编码 判重。
-- 【两账套】先正式 HSDZ_MES,后 HSDZ_MES_TEST,均执行到 DbSync「执行 0、失败 0」。
-- ════════════════════════════════════════════════════════════════════════════════════════

/* ═══════════════════ A. 补列(幂等:COL_LENGTH 守卫) ═══════════════════ */
/* A1. 检验方案(bs_qc_plan):取样规则 + 文件编码 + 执行标准(YJ-Q-125 §4 取样要求与文件依据) */
IF COL_LENGTH(N'dbo.bs_qc_plan', N'取样规则') IS NULL ALTER TABLE dbo.bs_qc_plan ADD [取样规则] nvarchar(500) NULL;
IF COL_LENGTH(N'dbo.bs_qc_plan', N'文件编码') IS NULL ALTER TABLE dbo.bs_qc_plan ADD [文件编码] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.bs_qc_plan', N'执行标准') IS NULL ALTER TABLE dbo.bs_qc_plan ADD [执行标准] nvarchar(200) NULL;

/* A2. 检验项目(bs_qc_item):归属方案 + 序号 + 取样要求/检验方法/合格处置/不合格处置 */
IF COL_LENGTH(N'dbo.bs_qc_item', N'方案编码')   IS NULL ALTER TABLE dbo.bs_qc_item ADD [方案编码]   nvarchar(200) NULL;
IF COL_LENGTH(N'dbo.bs_qc_item', N'序号')       IS NULL ALTER TABLE dbo.bs_qc_item ADD [序号]       int NULL;
IF COL_LENGTH(N'dbo.bs_qc_item', N'取样要求')   IS NULL ALTER TABLE dbo.bs_qc_item ADD [取样要求]   nvarchar(200) NULL;
IF COL_LENGTH(N'dbo.bs_qc_item', N'检验方法')   IS NULL ALTER TABLE dbo.bs_qc_item ADD [检验方法]   nvarchar(1000) NULL;
IF COL_LENGTH(N'dbo.bs_qc_item', N'合格处置')   IS NULL ALTER TABLE dbo.bs_qc_item ADD [合格处置]   nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bs_qc_item', N'不合格处置') IS NULL ALTER TABLE dbo.bs_qc_item ADD [不合格处置] nvarchar(100) NULL;
GO

/* A3. 三张工序检验单(同构,一起加):头 = 检验方案/文件编码/执行标准;行 = 表区/检验方法 */
DECLARE @t sysname, @th sysname, @td sysname;
DECLARE curA CURSOR LOCAL FAST_FORWARD FOR SELECT v FROM (VALUES (N'qc_mold_insp'), (N'qc_cut_insp'), (N'qc_asm_insp')) AS t(v);
OPEN curA FETCH NEXT FROM curA INTO @t;
WHILE @@FETCH_STATUS = 0
BEGIN
  SET @th = @t + N'_head';
  SET @td = @t + N'_detail';
  IF COL_LENGTH(N'dbo.' + @th, N'检验方案') IS NULL EXEC(N'ALTER TABLE dbo.' + @th + N' ADD [检验方案] nvarchar(200) NULL');
  IF COL_LENGTH(N'dbo.' + @th, N'文件编码') IS NULL EXEC(N'ALTER TABLE dbo.' + @th + N' ADD [文件编码] nvarchar(50) NULL');
  IF COL_LENGTH(N'dbo.' + @th, N'执行标准') IS NULL EXEC(N'ALTER TABLE dbo.' + @th + N' ADD [执行标准] nvarchar(200) NULL');
  IF COL_LENGTH(N'dbo.' + @td, N'表区')     IS NULL EXEC(N'ALTER TABLE dbo.' + @td + N' ADD [表区] nvarchar(50) NULL');
  IF COL_LENGTH(N'dbo.' + @td, N'检验方法') IS NULL EXEC(N'ALTER TABLE dbo.' + @td + N' ADD [检验方法] nvarchar(1000) NULL');
  FETCH NEXT FROM curA INTO @t;
END
CLOSE curA DEALLOCATE curA;
GO

/* A4. 中文注明(全量部署规范:新列必须带 MS_Description) */
DECLARE @c sysname, @tb sysname, @cmt nvarchar(200);
DECLARE curC CURSOR LOCAL FAST_FORWARD FOR SELECT * FROM (VALUES
  (N'bs_qc_plan', N'取样规则',   N'取样规则(YJ-Q-125 §4:每50kg取样1个、每个样品200g;人工填,系统不自动算量)'),
  (N'bs_qc_plan', N'文件编码',   N'文件编码(受控文件号,如 YJ-Q-125;建单时带到检验单抬头)'),
  (N'bs_qc_plan', N'执行标准',   N'执行标准(检验依据,方案缺失时检验单的兜底依据)'),
  (N'bs_qc_item', N'方案编码',   N'归属检验方案(bs_qc_plan.方案编码;方案 1..N 检验项目)'),
  (N'bs_qc_item', N'序号',       N'方案内排序(小的在前;空按 id)'),
  (N'bs_qc_item', N'取样要求',   N'取样/称料要求(YJ-Q-125 §6「称料:100g」这一列)'),
  (N'bs_qc_item', N'检验方法',   N'检验方法(YJ-Q-125 §6「接受标准及方法」的方法列,多步用换行/序号)'),
  (N'bs_qc_item', N'合格处置',   N'合格处置方式(YJ-Q-125 §7:成品=入库)'),
  (N'bs_qc_item', N'不合格处置', N'不合格处置方式(YJ-Q-125 §7:成品=重新筛分、原料=退货)')
) AS t(tb, c, cmt);
OPEN curC FETCH NEXT FROM curC INTO @tb, @c, @cmt;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF COL_LENGTH(N'dbo.' + @tb, @c) IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
                     WHERE ep.major_id = OBJECT_ID(N'dbo.' + @tb)
                       AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.' + @tb), @c, 'ColumnId')
                       AND ep.name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', @cmt, N'SCHEMA', N'dbo', N'TABLE', @tb, N'COLUMN', @c;
  FETCH NEXT FROM curC INTO @tb, @c, @cmt;
END
CLOSE curC DEALLOCATE curC;

DECLARE @i2 sysname, @t2 sysname, @tb2 sysname;
DECLARE curC2 CURSOR LOCAL FAST_FORWARD FOR SELECT v FROM (VALUES (N'qc_mold_insp'), (N'qc_cut_insp'), (N'qc_asm_insp')) AS t(v);
OPEN curC2 FETCH NEXT FROM curC2 INTO @t2;
WHILE @@FETCH_STATUS = 0
BEGIN
  SET @tb2 = @t2 + N'_head';
  SET @cmt = N'检验方案(参照 bs_qc_plan.方案编码;报工审核建单时按产品匹配带出)';
  IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID(N'dbo.' + @tb2)
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.' + @tb2), N'检验方案', 'ColumnId') AND ep.name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', @cmt, N'SCHEMA', N'dbo', N'TABLE', @tb2, N'COLUMN', N'检验方案';
  SET @cmt = N'文件编码(受控文件号,如 YJ-Q-125;随检验方案带入)';
  IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID(N'dbo.' + @tb2)
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.' + @tb2), N'文件编码', 'ColumnId') AND ep.name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', @cmt, N'SCHEMA', N'dbo', N'TABLE', @tb2, N'COLUMN', N'文件编码';
  SET @cmt = N'执行标准(检验依据;随检验方案带入)';
  IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID(N'dbo.' + @tb2)
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.' + @tb2), N'执行标准', 'ColumnId') AND ep.name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', @cmt, N'SCHEMA', N'dbo', N'TABLE', @tb2, N'COLUMN', N'执行标准';

  SET @tb2 = @t2 + N'_detail';
  SET @cmt = N'表区(分块键:检验项目=项目/标准/方法/实测/判定;数量判定=判定/数量/处理方式,组装成品分流用)';
  IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID(N'dbo.' + @tb2)
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.' + @tb2), N'表区', 'ColumnId') AND ep.name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', @cmt, N'SCHEMA', N'dbo', N'TABLE', @tb2, N'COLUMN', N'表区';
  SET @cmt = N'检验方法(表区=检验项目 时由检验项目档案带入)';
  IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID(N'dbo.' + @tb2)
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.' + @tb2), N'检验方法', 'ColumnId') AND ep.name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', @cmt, N'SCHEMA', N'dbo', N'TABLE', @tb2, N'COLUMN', N'检验方法';
  FETCH NEXT FROM curC2 INTO @t2;
END
CLOSE curC2 DEALLOCATE curC2;
GO

/* ═══════════════════ B. 存量回填「表区」(只判空,不覆盖已有值) ═══════════════════
   组装成品明细存量 2 行 = 合格/不合格数量行 ⇒ '数量判定';
   成型/切炭明细存量 = 通用模板行(检验项目='外观') ⇒ '检验项目'。 */
UPDATE dbo.qc_asm_insp_detail  SET [表区] = N'数量判定' WHERE [表区] IS NULL;
UPDATE dbo.qc_mold_insp_detail SET [表区] = N'检验项目' WHERE [表区] IS NULL;
UPDATE dbo.qc_cut_insp_detail  SET [表区] = N'检验项目' WHERE [表区] IS NULL;
GO

/* ═══════════════════ C. 面板字段登记(yj_field,已存在则跳过) ═══════════════════ */
/* C1. QC_ITEM 检验项目:方案编码/序号/取样要求/检验方法/合格处置/不合格处置(档案式面板:place=query,detail) */
DECLARE @fi TABLE (col nvarchar(50), seq int, width int);
INSERT INTO @fi VALUES
 (N'方案编码',   105, 140), (N'序号', 108, 70), (N'取样要求', 115, 160),
 (N'检验方法',   125, 320), (N'合格处置', 135, 110), (N'不合格处置', 145, 120);
DECLARE @cn nvarchar(50), @sq int, @wd int;
DECLARE curI CURSOR LOCAL FAST_FORWARD FOR SELECT col, seq, width FROM @fi;
OPEN curI FETCH NEXT FROM curI INTO @cn, @sq, @wd;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_ITEM' AND col_name = @cn)
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES (N'QC_ITEM', @cn, @cn, N'文本', N'query,detail', @sq, @wd, 1, 0, 0, 1);
  FETCH NEXT FROM curI INTO @cn, @sq, @wd;
END
CLOSE curI DEALLOCATE curI;

/* C2. QC_PLAN 检验方案:取样规则/文件编码/执行标准 */
DECLARE @fp TABLE (col nvarchar(50), seq int, width int);
INSERT INTO @fp VALUES (N'取样规则', 65, 260), (N'文件编码', 68, 110), (N'执行标准', 72, 160);
DECLARE curP CURSOR LOCAL FAST_FORWARD FOR SELECT col, seq, width FROM @fp;
OPEN curP FETCH NEXT FROM curP INTO @cn, @sq, @wd;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_PLAN' AND col_name = @cn)
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES (N'QC_PLAN', @cn, @cn, N'文本', N'query,detail', @sq, @wd, 1, 0, 0, 1);
  FETCH NEXT FROM curP INTO @cn, @sq, @wd;
END
CLOSE curP DEALLOCATE curP;

/* C3. 三张工序检验单:头 检验方案(参照 QC_PLAN)/文件编码/执行标准;明细 表区/检验方法 */
DECLARE @t3 sysname;
DECLARE curP3 CURSOR LOCAL FAST_FORWARD FOR SELECT v FROM (VALUES (N'QC_MOLD_INSP'), (N'QC_CUT_INSP'), (N'QC_ASM_INSP')) AS t(v);
OPEN curP3 FETCH NEXT FROM curP3 INTO @t3;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = @t3 AND col_name = N'检验方案')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
    VALUES (@t3, N'检验方案', N'检验方案', N'参照', N'QC_PLAN', N'方案名称', N'方案名称', N'query,header', 155, 160, 1, 0, 0, 1);
  IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = @t3 AND col_name = N'文件编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES (@t3, N'文件编码', N'文件编码', N'文本', N'query,header', 165, 110, 1, 0, 0, 1);
  IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = @t3 AND col_name = N'执行标准')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES (@t3, N'执行标准', N'执行标准', N'文本', N'header', 175, 160, 1, 0, 0, 1);
  IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = @t3 AND col_name = N'表区')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES (@t3, N'表区', N'表区', N'文本', N'detail', 190, 90, 0, 0, 0, 1);
  IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = @t3 AND col_name = N'检验方法')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES (@t3, N'检验方法', N'检验方法', N'文本', N'detail', 235, 320, 1, 0, 0, 1);
  FETCH NEXT FROM curP3 INTO @t3;
END
CLOSE curP3 DEALLOCATE curP3;
GO

/* ═══════════════════ D. 字段译名(至少 en;已有同名则跳过) ═══════════════════ */
DECLARE @ft TABLE (label nvarchar(50), en nvarchar(120));
INSERT INTO @ft VALUES
 (N'方案编码', N'Plan Code'), (N'序号', N'Seq'), (N'取样规则', N'Sampling Rule'),
 (N'取样要求', N'Sample Requirement'), (N'检验方法', N'Test Method'),
 (N'合格处置', N'Pass Disposition'), (N'不合格处置', N'Fail Disposition'),
 (N'检验方案', N'Inspection Plan'), (N'文件编码', N'Document Code'),
 (N'执行标准', N'Execution Standard'), (N'表区', N'Section');
DECLARE @lb nvarchar(50), @en nvarchar(120);
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

/* 两个新面板名无需译名(QC_ITEM/QC_PLAN 早已在册);面板级译名缺失时补 */
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'检验项目' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'检验项目', 'en', N'Inspection Item', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'检验方案' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'检验方案', 'en', N'Inspection Plan', 'manual');
GO

/* ═══════════════════ E. 播种 YJ-Q-125 主数据(幂等:按 方案编码/项目编码 判重) ═══════════════════
   ⚠ 这是**受控文件摘录的真数据**(不是演示数据):改它等于改标准,请在面板 QC_ITEM/QC_PLAN 上维护。 */
DECLARE @u nvarchar(50) = N'migration';

/* E1. 检验方案 */
IF NOT EXISTS (SELECT 1 FROM bs_qc_plan WHERE 方案编码 = N'QP-CAS18')
  INSERT INTO bs_qc_plan (方案编码, 方案名称, 适用存货, 适用存货类别, 检验方式, [抽检比例%], 取样规则, 文件编码, 执行标准, 停用, 备注, 状态, asp_user1, asp_time1)
  VALUES (N'QP-CAS18', N'Y料成品检验方案(CAS-18)', N'Y料', N'功能料-颗粒', N'抽检', NULL,
          N'每50kg成品取样1个，每个样品200g', N'YJ-Q-125', N'YJ-Q-125 Y料原料及成品检验规范 A0', 0,
          N'出自受控文件 YJ-Q-125 §6.2/§7.2;成品=目数(20目/325目筛分占比)', N'启用', @u, SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM bs_qc_plan WHERE 方案编码 = N'QP-YCAS23')
  INSERT INTO bs_qc_plan (方案编码, 方案名称, 适用存货, 适用存货类别, 检验方式, [抽检比例%], 取样规则, 文件编码, 执行标准, 停用, 备注, 状态, asp_user1, asp_time1)
  VALUES (N'QP-YCAS23', N'Y料原料检验方案(Y-CAS-23)', N'Y-CAS-23', NULL, N'抽检', NULL,
          N'每50kg原料取样1个，每个样品200g', N'YJ-Q-125', N'YJ-Q-125 Y料原料及成品检验规范 A0', 0,
          N'出自受控文件 YJ-Q-125 §6.1/§7.1;原料=性能(余氯去除率)+卫生安全(11项重金属)', N'启用', @u, SYSDATETIME());

/* E2. 检验项目:成品 CAS-18 目数(YJ-Q-125 §6.2「一项多区间」拆两条,才能逐项判合格) */
DECLARE @items TABLE (方案编码 nvarchar(200), 序号 int, 项目编码 nvarchar(200), 项目名称 nvarchar(200),
                      检验内容 nvarchar(200), 检验标准 nvarchar(200), 数据类型 nvarchar(100), 计量单位 nvarchar(200),
                      判定规则 nvarchar(100), 标准下限 decimal(18,4), 标准上限 decimal(18,4),
                      取样要求 nvarchar(200), 检验方法 nvarchar(1000), 合格处置 nvarchar(100), 不合格处置 nvarchar(100), 备注 nvarchar(500));
INSERT INTO @items VALUES
 (N'QP-CAS18', 10, N'FIN-MESH-P20',  N'目数(+20目)',  N'目数', N'+20目占比≤15%',  N'定量', N'%', N'上限判定', NULL, 15,
  N'称取100g', N'1.称取100g Y料成品，从上到下依次放20目、325目筛网进行震动筛分5min；2.称量计算各区间占比。', N'入库', N'重新筛分', N'YJ-Q-125 §6.2'),
 (N'QP-CAS18', 20, N'FIN-MESH-M325', N'目数(-325目)', N'目数', N'-325目占比≤10%', N'定量', N'%', N'上限判定', NULL, 10,
  N'称取100g', N'1.称取100g Y料成品，从上到下依次放20目、325目筛网进行震动筛分5min；2.称量计算各区间占比。', N'入库', N'重新筛分', N'YJ-Q-125 §6.2'),
 /* 原料 Y-CAS-23:性能(YJ-Q-125 §6.1) */
 (N'QP-YCAS23', 10, N'RCV-PERF-CL', N'性能(余氯去除率)', N'性能', N'余氯去除率≥80%', N'定量', N'%', N'下限判定', 80, NULL,
  N'称取40g', N'1.称取40g 原料封装小T筒，进出水端用海绵压实；2.纯水加次氯酸钠加标，余氯含量2±0.2ppm；3.流速2L/min，冲2min取样测试余氯去除率。', NULL, N'退货', N'YJ-Q-125 §6.1');

/* 原料 卫生安全 11 项重金属(限值单位 mg/L,全部上限判定) */
DECLARE @hm TABLE (序号 int, 项目编码 nvarchar(200), 项目名称 nvarchar(200), 检验标准 nvarchar(200), 限值 decimal(18,4));
INSERT INTO @hm VALUES
 (20, N'RCV-HEALTH-CD', N'卫生安全(镉增加量)', N'镉增加量≤0.0005mg/L', 0.0005),
 (21, N'RCV-HEALTH-PB', N'卫生安全(铅增加量)', N'铅增加量≤0.001mg/L',  0.0010),
 (22, N'RCV-HEALTH-CR', N'卫生安全(铬增加量)', N'铬增加量≤0.005mg/L',  0.0050),
 (23, N'RCV-HEALTH-FE', N'卫生安全(铁增加量)', N'铁增加量≤0.06mg/L',   0.0600),
 (24, N'RCV-HEALTH-MN', N'卫生安全(锰增加量)', N'锰增加量≤0.04mg/L',   0.0400),
 (25, N'RCV-HEALTH-AL', N'卫生安全(铝增加量)', N'铝增加量≤0.02mg/L',   0.0200),
 (26, N'RCV-HEALTH-CU', N'卫生安全(铜增加量)', N'铜增加量≤0.2mg/L',    0.2000),
 (27, N'RCV-HEALTH-ZN', N'卫生安全(锌增加量)', N'锌增加量≤0.2mg/L',    0.2000),
 (28, N'RCV-HEALTH-AG', N'卫生安全(银增加量)', N'银增加量≤0.005mg/L',  0.0050),
 (29, N'RCV-HEALTH-AS', N'卫生安全(砷增加量)', N'砷增加量≤0.001mg/L',  0.0010),
 (30, N'RCV-HEALTH-NI', N'卫生安全(镍增加量)', N'镍增加量≤0.002mg/L',  0.0020);
INSERT INTO @items (方案编码, 序号, 项目编码, 项目名称, 检验内容, 检验标准, 数据类型, 计量单位, 判定规则, 标准下限, 标准上限, 取样要求, 检验方法, 合格处置, 不合格处置, 备注)
SELECT N'QP-YCAS23', 序号, 项目编码, 项目名称, N'卫生安全', 检验标准, N'定量', N'mg/L', N'上限判定', NULL, 限值,
       N'称取10g', N'1.取10g来料，加入100ml浸泡液润洗两次，加100ml浸泡液浸泡24h±1h，中速滤纸过滤；2.用icp-ms测试离子含量。', NULL, N'退货', N'YJ-Q-125 §6.1'
  FROM @hm;

INSERT INTO bs_qc_item (项目编码, 项目名称, 检验内容, 检验标准, 数据类型, 计量单位, 判定规则, 标准下限, 标准上限,
                        方案编码, 序号, 取样要求, 检验方法, 合格处置, 不合格处置, 停用, 备注, 状态, asp_user1, asp_time1)
SELECT i.项目编码, i.项目名称, i.检验内容, i.检验标准, i.数据类型, i.计量单位, i.判定规则, i.标准下限, i.标准上限,
       i.方案编码, i.序号, i.取样要求, i.检验方法, i.合格处置, i.不合格处置, 0, i.备注, N'启用', @u, SYSDATETIME()
  FROM @items i
 WHERE NOT EXISTS (SELECT 1 FROM bs_qc_item c WHERE c.项目编码 = i.项目编码);
GO

/* ═══════════════════ F. 自检 ═══════════════════ */
DECLARE @bad int = 0;
/* F1. 列齐(方案 3 列 / 项目 6 列 / 检验单 头 3 列 + 行 2 列 × 3 组) */
IF COL_LENGTH(N'dbo.bs_qc_plan', N'取样规则') IS NULL OR COL_LENGTH(N'dbo.bs_qc_plan', N'文件编码') IS NULL
   OR COL_LENGTH(N'dbo.bs_qc_plan', N'执行标准') IS NULL SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.bs_qc_item', N'方案编码') IS NULL OR COL_LENGTH(N'dbo.bs_qc_item', N'序号') IS NULL
   OR COL_LENGTH(N'dbo.bs_qc_item', N'取样要求') IS NULL OR COL_LENGTH(N'dbo.bs_qc_item', N'检验方法') IS NULL
   OR COL_LENGTH(N'dbo.bs_qc_item', N'合格处置') IS NULL OR COL_LENGTH(N'dbo.bs_qc_item', N'不合格处置') IS NULL SET @bad = @bad + 1;
IF EXISTS (SELECT 1 FROM (VALUES (N'qc_mold_insp'), (N'qc_cut_insp'), (N'qc_asm_insp')) AS t(v)
           WHERE COL_LENGTH(N'dbo.' + v + N'_head', N'检验方案') IS NULL
              OR COL_LENGTH(N'dbo.' + v + N'_head', N'文件编码') IS NULL
              OR COL_LENGTH(N'dbo.' + v + N'_head', N'执行标准') IS NULL
              OR COL_LENGTH(N'dbo.' + v + N'_detail', N'表区') IS NULL
              OR COL_LENGTH(N'dbo.' + v + N'_detail', N'检验方法') IS NULL) SET @bad = @bad + 1;
/* F2. 字段登记齐 */
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'QC_ITEM' AND col_name IN (N'方案编码', N'序号', N'取样要求', N'检验方法', N'合格处置', N'不合格处置')) < 6 SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'QC_PLAN' AND col_name IN (N'取样规则', N'文件编码', N'执行标准')) < 3 SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code IN (N'QC_MOLD_INSP', N'QC_CUT_INSP', N'QC_ASM_INSP') AND col_name IN (N'检验方案', N'文件编码', N'执行标准', N'表区', N'检验方法')) < 15 SET @bad = @bad + 1;
/* F3. 译名齐 */
IF (SELECT COUNT(*) FROM yj_translation WHERE scope = 'field' AND locale = 'en'
      AND ref_key IN (N'方案编码', N'序号', N'取样规则', N'取样要求', N'检验方法', N'合格处置', N'不合格处置', N'检验方案', N'文件编码', N'执行标准', N'表区')) < 11 SET @bad = @bad + 1;
/* F4. 播种齐(2 方案 / 14 项目:成品 2 + 原料 12) */
IF (SELECT COUNT(*) FROM bs_qc_plan WHERE 方案编码 IN (N'QP-CAS18', N'QP-YCAS23')) < 2 SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM bs_qc_item WHERE 方案编码 = N'QP-CAS18') < 2 SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM bs_qc_item WHERE 方案编码 = N'QP-YCAS23') < 12 SET @bad = @bad + 1;
/* F5. 表区已回填(不留 NULL —— 分块键为空会让行"读不回来") */
IF (SELECT COUNT(*) FROM qc_asm_insp_detail WHERE 表区 IS NULL) > 0 SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM qc_mold_insp_detail WHERE 表区 IS NULL) > 0 SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM qc_cut_insp_detail WHERE 表区 IS NULL) > 0 SET @bad = @bad + 1;
IF @bad > 0 RAISERROR(N'检验项目/检验方案迁移自检失败(缺列/缺字段/缺译名/缺播种/表区残留 NULL)', 16, 1);
ELSE PRINT N'检验项目/检验方案就绪:bs_qc_plan +3 列 / bs_qc_item +6 列 / 三类检验单 头+3 行+2;'
         + N'播种 2 方案 14 项目(YJ-Q-125 成品 CAS-18 目数 2 项 + 原料 Y-CAS-23 性能 1 + 卫生安全 11)';
