/* =============================================================================
   migrate-qc-plan-applicable-doc-20261021.sql — 检验标准库按「单据」分套
   + 组装成品检验单置顶方案（外观、尺寸、重量）

   【用户口径（2026-10-21）】
     「当前组装检验单的各个单据的检验项目高度雷同需要对这个进行差异化修改，
       并且增加几条检验项目中的检验标准库，最顶上填写一条检验项目为外观，尺寸，重量的标准库项目。」

   【落地口径（用户已拍板）】
     ① 差异化落在**标准库按单据分套**：bs_qc_plan 增「适用单据」，
        首件 / 制程 / 组装各维护自己的一套方案，弹窗默认只显示本单适用的方案；
        勾「显示全部单据的方案」可维护全部（旧 Y料方案不删，只是不混进这三张单）。
     ② 组装成品检验单最顶上新增一套「组装成品检验方案（外观、尺寸、重量）」：
        方案编码 QP-ASM-00（编码升序天然置顶），检验类型 = 外观、尺寸、重量，
        下挂 外观 / 尺寸 / 重量 三条检验项目。
     ③ 同批补几条可用的标准库项目：组装性能（强度/流速/压降/余氯）、
        首件（外观/尺寸/重量/强度/浊度）、制程（外观/尺寸/重量/流速/压降/余氯）。

   【为什么不是改现有 50 张 ZJ-* 单的明细】
     检验单明细是**文本快照**（带入时只写文本，不存标准库条目 id），
     改标准库不会污染已录入单据；存量单要按新产品标准重填，应由品质在单上
     「检验项目/检验方案」重新带入，不能按产品猜项目批量改库。

   【幂等】
     · 加列 COL_LENGTH 判空；注明/字段/译名按存在性判重；
     · 方案按「方案编码」判重，已存在则只补空的「适用单据」；
     · 项目按「项目编码」判重；重复执行 INSERT 0 行。
   【两账套】先 HSDZ_MES，后 HSDZ_MES_TEST（DbSync run）。
   ============================================================================= */
SET NOCOUNT ON;
GO

/* ══════════════════ A. bs_qc_plan 加「适用单据」 ══════════════════ */
IF COL_LENGTH(N'dbo.bs_qc_plan', N'适用单据') IS NULL
  ALTER TABLE dbo.bs_qc_plan ADD 适用单据 nvarchar(200) NULL;
GO

DECLARE @cmt nvarchar(400) = N'适用单据（检验单面板代号，逗号分隔：QC_FIRST_INSP=首件检验单 / QC_PROC_INSP=制程检验单 / '
  + N'QC_ASM_INSP=组装成品检验单；空 = 未归档，默认不混进任一单据的标准库列表，勾「显示全部单据的方案」可维护）';
IF COL_LENGTH(N'dbo.bs_qc_plan', N'适用单据') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.extended_properties
                    WHERE major_id = OBJECT_ID(N'dbo.bs_qc_plan')
                      AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bs_qc_plan'), N'适用单据', 'ColumnId')
                      AND name = N'MS_Description' AND class = 1)
  EXEC sp_addextendedproperty N'MS_Description', @cmt, N'SCHEMA', N'dbo',
       N'TABLE', N'bs_qc_plan', N'COLUMN', N'适用单据';
GO

/* yj_field 登记（QC_PLAN 基础档案面板；seq 夹在 检验类型(68) 与 停用(70) 之间） */
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_PLAN' AND col_name = N'适用单据')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES (N'QC_PLAN', N'适用单据', N'适用单据', N'文本', N'query,detail', 69, 150, 1, 0, 0, 1);
GO
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'适用单据' AND locale = N'en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source)
  VALUES (N'field', N'适用单据', N'en', N'Applicable Document', N'manual');
GO

/* ══════════════════ B. 四套方案种子（组装两套，首件/制程各一套） ══════════════════ */
DECLARE @u nvarchar(50) = N'migration';
DECLARE @plans TABLE (
  方案编码 nvarchar(400), 方案名称 nvarchar(400), 适用存货 nvarchar(400), 适用存货类别 nvarchar(400),
  检验方式 nvarchar(200), 取样规则 nvarchar(1000), 检验类型 nvarchar(200), 适用单据 nvarchar(200),
  执行标准 nvarchar(400), 备注 nvarchar(1000));
INSERT INTO @plans VALUES
 (N'QP-ASM-00', N'组装成品检验方案（外观、尺寸、重量）', NULL, N'炭棒/滤芯', N'抽检',
  N'按《出货检验计划表》每批抽检；外观/尺寸/重量默认各抽 2 支', N'外观、尺寸、重量', N'QC_ASM_INSP',
  N'按产品规格书 / 出货检验计划', N'2026-10-21 置顶方案：方案 = 外观/尺寸/重量三类，下方三条项目各自携带类别'),
 (N'QP-ASM-01', N'组装成品性能检验方案', NULL, N'炭棒/滤芯', N'抽检',
  N'每批抽 1~2 支；型式检验项目按产品标准送检', N'性能', N'QC_ASM_INSP',
  N'按产品规格书 / 客户要求', N'2026-10-21 补：强度/初始流速/压降/余氯去除率'),
 (N'QP-FIRST-01', N'首件检验方案（成型首件）', NULL, N'炭棒/滤芯', N'抽检',
  N'每批首件抽 2 支', N'外观、尺寸、重量', N'QC_FIRST_INSP',
  N'按《成型工艺清单》 / 产品规格书', N'2026-10-21 补：成型首件的外观/尺寸/重量/强度/浊度'),
 (N'QP-PROC-01', N'制程检验方案（过程控制）', NULL, N'炭棒/滤芯', N'抽检',
  N'外观/尺寸/重量每 2 小时抽 2 支；性能每班抽 1 支', N'外观、尺寸、重量、性能', N'QC_PROC_INSP',
  N'按产品规格书 / 出货检验计划', N'2026-10-21 补：制程过程控制的外观/尺寸/重量/流速/压降/余氯');

INSERT INTO dbo.bs_qc_plan
  (方案编码, 方案名称, 适用存货, 适用存货类别, 检验方式, [抽检比例%], 取样规则,
   检验类型, 适用单据, 执行标准, 备注, 停用, 状态, asp_user1, asp_time1)
SELECT p.方案编码, p.方案名称, p.适用存货, p.适用存货类别, p.检验方式, NULL, p.取样规则,
       p.检验类型, p.适用单据, p.执行标准, p.备注, 0, N'启用', @u, SYSDATETIME()
  FROM @plans p
 WHERE NOT EXISTS (SELECT 1 FROM dbo.bs_qc_plan x WHERE x.方案编码 = p.方案编码
                     AND ISNULL(x.asp_cancel, N'N') <> N'Y');
PRINT N'[OK] 四套检验方案新增:' + CAST(@@ROWCOUNT AS nvarchar(4)) + N' 行';

/* 已存在但「适用单据」为空 ⇒ 补上（不覆盖人工改过的值） */
UPDATE x SET 适用单据 = p.适用单据
  FROM dbo.bs_qc_plan x JOIN @plans p ON p.方案编码 = x.方案编码
 WHERE ISNULL(x.适用单据, N'') = N'';
PRINT N'[OK] 方案补「适用单据」:' + CAST(@@ROWCOUNT AS nvarchar(4)) + N' 行';
GO

/* ══════════════════ C. 检验项目种子（18 条） ══════════════════ */
DECLARE @u nvarchar(50) = N'migration';
DECLARE @items TABLE (
  项目编码 nvarchar(400), 项目名称 nvarchar(400), 检验内容 nvarchar(400), 检验标准 nvarchar(400),
  数据类型 nvarchar(200), 计量单位 nvarchar(400), 判定规则 nvarchar(200),
  标准下限 decimal(18,4), 标准上限 decimal(18,4), 方案编码 nvarchar(400), 序号 int,
  取样要求 nvarchar(400), 检验方法 nvarchar(2000),
  合格处置 nvarchar(200), 不合格处置 nvarchar(200), 检验数量 int, 备注 nvarchar(1000));
INSERT INTO @items VALUES
 /* ── 组装成品 · 置顶方案：外观 / 尺寸 / 重量 ── */
 (N'ASM-APPEARANCE', N'外观', N'外观',
  N'清洁、无破损无压痕、无裂纹、无倾斜；切面平整无锯齿纹路、无明显缺角、无残留炭渣',
  N'定性', NULL, N'符合标准', NULL, NULL, N'QP-ASM-00', 10,
  N'随机抽取2支', N'目视检查', N'入库', N'隔离返工', 2,
  N'组装成品外观通用要求；具体以产品规格书/出货检验计划为准'),
 (N'ASM-DIMENSION', N'尺寸', N'尺寸',
  N'外径、内径、长度符合产品图纸及规格书公差要求',
  N'定量', N'mm', N'区间判定', NULL, NULL, N'QP-ASM-00', 20,
  N'随机抽取2支', N'游标卡尺测量外径、内径、长度', N'入库', N'返工/报废', 2,
  N'公差按产品图纸；不同产品在出货检验计划里写具体值'),
 (N'ASM-WEIGHT', N'重量', N'重量',
  N'符合产品标准重量及出货检验计划要求',
  N'定量', N'g', N'区间判定', NULL, NULL, N'QP-ASM-00', 30,
  N'随机抽取2支', N'电子秤称量', N'入库', N'返工/报废', 2,
  N'标准重量按产品规格书/出货检验计划'),

 /* ── 组装成品 · 性能方案 ── */
 (N'ASM-STRENGTH', N'抗压强度', N'性能',
  N'≥30kgf（具体以产品标准为准）',
  N'定量', N'kgf', N'下限判定', 30, NULL, N'QP-ASM-01', 10,
  N'随机取2支', N'将炭棒水平放置在强度仪上，间距40mm，下压速度5mm/min，读取断裂时最大力',
  N'入库', N'隔离评估', 2, N'限值按产品标准调整'),
 (N'ASM-FLOW', N'初始流速', N'性能',
  N'静态压力0.1MPa条件下，初始流速符合产品标准',
  N'定量', N'L/min', N'下限判定', NULL, NULL, N'QP-ASM-01', 20,
  N'随机取1支', N'将炭棒装入滤瓶，按进水方向通水1min，测量流量',
  N'入库', N'隔离评估', 1, N'压力/流量限值按产品标准'),
 (N'ASM-PRESSURE', N'压降', N'性能',
  N'测试流速3L/min，压降符合产品标准',
  N'定量', N'kPa', N'上限判定', NULL, NULL, N'QP-ASM-01', 30,
  N'随机取1支', N'滤芯前后接压力表，通水10min后读取压差',
  N'入库', N'隔离评估', 1, N'压降限值按产品标准'),
 (N'ASM-CHLORINE', N'余氯去除率', N'性能',
  N'初始余氯去除率≥98%（具体以产品标准为准）',
  N'定量', N'%', N'下限判定', 98, NULL, N'QP-ASM-01', 40,
  N'随机取1支', N'次氯酸钠加标，余氯浓度2.0±0.2mg/L，通水5min后取样测试',
  N'入库', N'隔离评估', 1, N'去除率限值按产品标准'),

 /* ── 首件检验（成型首件） ── */
 (N'FIRST-APPEARANCE', N'外观', N'外观',
  N'无粘模、无明显脱粉、无裂纹缺角，切面平整',
  N'定性', NULL, N'符合标准', NULL, NULL, N'QP-FIRST-01', 10,
  N'随机取2支', N'目视、手摸检查', N'转下道', N'停止生产并隔离', 2,
  N'首件按《成型工艺清单》执行'),
 (N'FIRST-DIMENSION', N'尺寸', N'尺寸',
  N'外径、内径、长度符合《成型工艺清单》及产品图纸公差',
  N'定量', N'mm', N'区间判定', NULL, NULL, N'QP-FIRST-01', 20,
  N'随机取2支', N'游标卡尺测量', N'转下道', N'调整模具/返工', 2,
  N'首件按《成型工艺清单》公差'),
 (N'FIRST-WEIGHT', N'重量', N'重量',
  N'符合《成型工艺清单》标准重量',
  N'定量', N'g', N'区间判定', NULL, NULL, N'QP-FIRST-01', 30,
  N'随机取2支', N'电子秤称量', N'转下道', N'调整配方/返工', 2,
  N'首件按《成型工艺清单》重量'),
 (N'FIRST-STRENGTH', N'抗压强度', N'性能',
  N'≥30kgf（具体以产品标准为准）',
  N'定量', N'kgf', N'下限判定', 30, NULL, N'QP-FIRST-01', 40,
  N'随机取2支', N'强度仪测试', N'转下道', N'停止生产并隔离', 2,
  N'限值按产品标准调整'),
 (N'FIRST-TURBIDITY', N'浊度', N'性能',
  N'浊度≤3NTU（具体以产品标准为准）',
  N'定量', N'NTU', N'上限判定', NULL, 3, N'QP-FIRST-01', 50,
  N'随机取2支', N'按产品标准冲洗后取样，用浊度仪测试',
  N'转下道', N'停止生产并隔离', 2, N'限值按产品标准调整'),

 /* ── 制程检验（过程控制） ── */
 (N'PROC-APPEARANCE', N'外观', N'外观',
  N'清洁、无破损无压痕、无裂纹、无倾斜',
  N'定性', NULL, N'符合标准', NULL, NULL, N'QP-PROC-01', 10,
  N'每2小时抽2支', N'目视检查', N'继续生产', N'隔离返工', 2,
  N'制程过程控制'),
 (N'PROC-DIMENSION', N'尺寸', N'尺寸',
  N'外径、内径、长度符合产品图纸及规格书公差',
  N'定量', N'mm', N'区间判定', NULL, NULL, N'QP-PROC-01', 20,
  N'每2小时抽2支', N'游标卡尺测量', N'继续生产', N'停机调整', 2,
  N'制程过程控制'),
 (N'PROC-WEIGHT', N'重量', N'重量',
  N'符合产品标准重量',
  N'定量', N'g', N'区间判定', NULL, NULL, N'QP-PROC-01', 30,
  N'每2小时抽2支', N'电子秤称量', N'继续生产', N'停机调整', 2,
  N'制程过程控制'),
 (N'PROC-FLOW', N'初始流速', N'性能',
  N'静态压力0.1MPa条件下，初始流速符合产品标准',
  N'定量', N'L/min', N'下限判定', NULL, NULL, N'QP-PROC-01', 40,
  N'每班抽1支', N'装滤瓶通水1min测量流量', N'继续生产', N'隔离评估', 1,
  N'压力/流量限值按产品标准'),
 (N'PROC-PRESSURE', N'压降', N'性能',
  N'测试流速3L/min，压降符合产品标准',
  N'定量', N'kPa', N'上限判定', NULL, NULL, N'QP-PROC-01', 50,
  N'每班抽1支', N'滤芯前后接压力表，通水10min读取压差', N'继续生产', N'隔离评估', 1,
  N'压降限值按产品标准'),
 (N'PROC-CHLORINE', N'余氯去除率', N'性能',
  N'初始余氯去除率≥98%（具体以产品标准为准）',
  N'定量', N'%', N'下限判定', 98, NULL, N'QP-PROC-01', 60,
  N'每班抽1支', N'次氯酸钠加标，余氯2.0±0.2mg/L，通水5min取样测试', N'继续生产', N'隔离评估', 1,
  N'去除率限值按产品标准');

INSERT INTO dbo.bs_qc_item
  (项目编码, 项目名称, 检验内容, 检验标准, 数据类型, 计量单位, 判定规则, 标准下限, 标准上限,
   方案编码, 序号, 取样要求, 检验方法, 合格处置, 不合格处置, 检验数量, 停用, 备注, 状态,
   asp_user1, asp_time1)
SELECT i.项目编码, i.项目名称, i.检验内容, i.检验标准, i.数据类型, i.计量单位, i.判定规则,
       i.标准下限, i.标准上限, i.方案编码, i.序号, i.取样要求, i.检验方法,
       i.合格处置, i.不合格处置, i.检验数量, 0, i.备注, N'启用', @u, SYSDATETIME()
  FROM @items i
 WHERE NOT EXISTS (SELECT 1 FROM dbo.bs_qc_item c WHERE c.项目编码 = i.项目编码
                     AND ISNULL(c.asp_cancel, N'N') <> N'Y');
PRINT N'[OK] 检验项目新增:' + CAST(@@ROWCOUNT AS nvarchar(4)) + N' 行（种子 18 条）';
GO

/* ══════════════════ D. 自检 ══════════════════ */
DECLARE @bad int = 0;
IF COL_LENGTH(N'dbo.bs_qc_plan', N'适用单据') IS NULL SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM dbo.bs_qc_plan
     WHERE 方案编码 IN (N'QP-ASM-00', N'QP-ASM-01', N'QP-FIRST-01', N'QP-PROC-01')
       AND ISNULL(asp_cancel, N'N') <> N'Y') <> 4 SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM dbo.bs_qc_plan
                WHERE 方案编码 = N'QP-ASM-00' AND CHARINDEX(N'QC_ASM_INSP', ISNULL(适用单据, N'')) > 0
                  AND 检验类型 = N'外观、尺寸、重量') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM dbo.bs_qc_plan
                WHERE 方案编码 = N'QP-FIRST-01' AND CHARINDEX(N'QC_FIRST_INSP', ISNULL(适用单据, N'')) > 0) SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM dbo.bs_qc_plan
                WHERE 方案编码 = N'QP-PROC-01' AND CHARINDEX(N'QC_PROC_INSP', ISNULL(适用单据, N'')) > 0) SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM dbo.bs_qc_item
     WHERE 方案编码 = N'QP-ASM-00' AND 检验内容 IN (N'外观', N'尺寸', N'重量')
       AND ISNULL(asp_cancel, N'N') <> N'Y') <> 3 SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM dbo.bs_qc_item
     WHERE 项目编码 IN (N'ASM-APPEARANCE', N'ASM-DIMENSION', N'ASM-WEIGHT',
                        N'ASM-STRENGTH', N'ASM-FLOW', N'ASM-PRESSURE', N'ASM-CHLORINE',
                        N'FIRST-APPEARANCE', N'FIRST-DIMENSION', N'FIRST-WEIGHT',
                        N'FIRST-STRENGTH', N'FIRST-TURBIDITY',
                        N'PROC-APPEARANCE', N'PROC-DIMENSION', N'PROC-WEIGHT',
                        N'PROC-FLOW', N'PROC-PRESSURE', N'PROC-CHLORINE')
       AND ISNULL(asp_cancel, N'N') <> N'Y') < 18 SET @bad = @bad + 1;
/* 项目编码不许重复（同一编码只能有一条存活行） */
IF EXISTS (SELECT 项目编码 FROM dbo.bs_qc_item
            WHERE 项目编码 LIKE N'ASM-%' OR 项目编码 LIKE N'FIRST-%' OR 项目编码 LIKE N'PROC-%'
            GROUP BY 项目编码 HAVING COUNT(*) > 1) SET @bad = @bad + 1;

IF @bad > 0
  RAISERROR(N'检验标准库按单据分套迁移自检失败（%d 项）', 16, 1, @bad);
ELSE
  PRINT N'检验标准库按单据分套就绪：适用单据列 + 4 套方案 + 18 条项目（组装置顶 QP-ASM-00：外观/尺寸/重量）';
GO
