/* migrate-process-routing-tasks.sql(2026-10-05):A 路线驱动工序任务 —— 数据层
 *
 * 依据(用户选定路线 A):「工单按工艺路线生成**工序任务**,每道工序一份待加工列表、可排序、可派工到线/机台,
 *   报工回写任务」;工序/工艺口径依《新系统产线命名.xlsx》= **成型 / 切炭 / 组装**(装箱归组装)。
 *
 * 三件事:
 * ① 产品 → 工艺路线绑定:`bs_inv.工艺路线`(存 bs_route.工艺路线编码)。产品没绑 = 走默认路线。
 * ② 工序任务载体:**复用既有 `wo_progress`(工单工序进度,实测 0 行、有面板 WO_PROGRESS)**扩列,
 *    不另造表(它是"工单×工序"的天然载体)。新增列:工单行id/批次号/工序序/生产车间/生产线/
 *    状态/优先级/排序号/计划完工日期/产品编码/产品名称/规格型号。
 *    状态口径:待加工 → 在加工(派工到线) → 已完工(报工完成量≥计划量)。
 * ③ 默认工艺路线 `GY-CB-STD`「炭棒标准路线」:成型(1) → 切炭(2) → 组装(3),生产车间=同名功能车间;
 *    工序编码取 bs_op 既有档案(OP-CX 成型 / OP-QT 切炭 / OP-ZZ 组装)。已有则不覆盖。
 *
 * 幂等可重跑;两账套均执行。
 */

/* ① 产品 → 工艺路线 */
IF COL_LENGTH('bs_inv', N'工艺路线') IS NULL ALTER TABLE bs_inv ADD [工艺路线] nvarchar(50) NULL;
GO

/* ② 工序任务(wo_progress 扩列) */
IF COL_LENGTH('wo_progress', N'工单行id') IS NULL ALTER TABLE wo_progress ADD [工单行id] bigint NULL;
IF COL_LENGTH('wo_progress', N'批次号') IS NULL ALTER TABLE wo_progress ADD [批次号] nvarchar(50) NULL;
IF COL_LENGTH('wo_progress', N'工序序') IS NULL ALTER TABLE wo_progress ADD [工序序] int NULL;
IF COL_LENGTH('wo_progress', N'生产车间') IS NULL ALTER TABLE wo_progress ADD [生产车间] nvarchar(50) NULL;
IF COL_LENGTH('wo_progress', N'生产线') IS NULL ALTER TABLE wo_progress ADD [生产线] nvarchar(50) NULL;
IF COL_LENGTH('wo_progress', N'状态') IS NULL ALTER TABLE wo_progress ADD [状态] nvarchar(20) NULL;
IF COL_LENGTH('wo_progress', N'优先级') IS NULL ALTER TABLE wo_progress ADD [优先级] nvarchar(20) NULL;
IF COL_LENGTH('wo_progress', N'排序号') IS NULL ALTER TABLE wo_progress ADD [排序号] int NULL;
IF COL_LENGTH('wo_progress', N'计划完工日期') IS NULL ALTER TABLE wo_progress ADD [计划完工日期] date NULL;
IF COL_LENGTH('wo_progress', N'产品编码') IS NULL ALTER TABLE wo_progress ADD [产品编码] nvarchar(50) NULL;
IF COL_LENGTH('wo_progress', N'产品名称') IS NULL ALTER TABLE wo_progress ADD [产品名称] nvarchar(200) NULL;
IF COL_LENGTH('wo_progress', N'规格型号') IS NULL ALTER TABLE wo_progress ADD [规格型号] nvarchar(200) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_wo_progress_工序队列' AND object_id = OBJECT_ID(N'dbo.wo_progress'))
  CREATE INDEX ix_wo_progress_工序队列 ON dbo.wo_progress (工序, 状态, 排序号, 计划完工日期);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_wo_progress_工单' AND object_id = OBJECT_ID(N'dbo.wo_progress'))
  CREATE INDEX ix_wo_progress_工单 ON dbo.wo_progress (单据编号, 工序);
GO

/* ③ 默认炭棒标准路线(成型→切炭→组装;按文件功能口径) */
IF NOT EXISTS (SELECT 1 FROM bs_route WHERE 工艺路线编码 = N'GY-CB-STD' AND ISNULL(asp_cancel,'N') <> 'Y')
  INSERT INTO bs_route (工艺路线编码, 工艺路线名称, 停用, 加工顺序, 工序编码, 工序名称, 加工方式, 生产车间,
                        [标准合格率%], 默认报工数量, 状态, asp_user1, asp_time1, asp_cancel)
  VALUES
   (N'GY-CB-STD', N'炭棒标准路线', 0, 1, N'OP-CX', N'成型', N'自制', N'成型', 100, 0, N'启用', N'migrate-process-routing-tasks', GETDATE(), N'N'),
   (N'GY-CB-STD', N'炭棒标准路线', 0, 2, N'OP-QT', N'切炭', N'自制', N'切炭', 100, 0, N'启用', N'migrate-process-routing-tasks', GETDATE(), N'N'),
   (N'GY-CB-STD', N'炭棒标准路线', 0, 3, N'OP-ZZ', N'组装', N'自制', N'组装', 100, 0, N'启用', N'migrate-process-routing-tasks', GETDATE(), N'N');
GO

/* ④ 中文注明(新增列必须带 MS_Description) */
DECLARE @cols TABLE (tbl sysname, col sysname, cmt nvarchar(300));
INSERT INTO @cols VALUES
 (N'bs_inv',     N'工艺路线',      N'产品的工艺路线编码(→bs_route.工艺路线编码;空=走默认路线 GY-CB-STD)'),
 (N'wo_progress',N'工单行id',      N'工序任务所属工单行(=plang.id)'),
 (N'wo_progress',N'批次号',        N'工序任务所属批次(=plang.批次号)'),
 (N'wo_progress',N'工序序',        N'工序顺序号(取工艺路线 加工顺序;1=第一道)'),
 (N'wo_progress',N'生产车间',      N'该工序所属功能(成型/切炭/组装 —— 依《新系统产线命名.xlsx》)'),
 (N'wo_progress',N'生产线',        N'派工到的产线(空=未派工)'),
 (N'wo_progress',N'状态',          N'工序任务状态:待加工/在加工/已完工'),
 (N'wo_progress',N'优先级',        N'优先级(普通/急单;急单排在普通之前)'),
 (N'wo_progress',N'排序号',        N'同工序队列内的顺序号(人工排序用;空=按 优先级→交期 自动排)'),
 (N'wo_progress',N'计划完工日期',  N'该工序的计划完工日(默认取工单交期)'),
 (N'wo_progress',N'产品编码',      N'产品编码(冗余,列表直接显示免联表)'),
 (N'wo_progress',N'产品名称',      N'产品名称(冗余)'),
 (N'wo_progress',N'规格型号',      N'规格型号(冗余)');
DECLARE @t sysname, @c sysname, @m nvarchar(300);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT tbl, col, cmt FROM @cols;
OPEN cur FETCH NEXT FROM cur INTO @t, @c, @m;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
                 WHERE ep.major_id = OBJECT_ID(N'dbo.' + @t) AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.' + @t), @c, 'ColumnId')
                   AND ep.name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', @m, N'SCHEMA', N'dbo', N'TABLE', @t, N'COLUMN', @c;
  FETCH NEXT FROM cur INTO @t, @c, @m;
END
CLOSE cur DEALLOCATE cur;
GO

/* ⑤ 自检 */
DECLARE @bad int = 0;
IF COL_LENGTH('bs_inv', N'工艺路线') IS NULL SET @bad = @bad + 1;
IF COL_LENGTH('wo_progress', N'状态') IS NULL OR COL_LENGTH('wo_progress', N'工序序') IS NULL SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM bs_route WHERE 工艺路线编码 = N'GY-CB-STD' AND ISNULL(asp_cancel,'N') <> 'Y') <> 3 SET @bad = @bad + 1;
IF @bad > 0 RAISERROR(N'路线驱动工序任务:数据层自检失败', 16, 1);
ELSE PRINT N'路线驱动工序任务就绪:bs_inv.工艺路线 + wo_progress 扩列 + 默认路线 GY-CB-STD(成型→切炭→组装)';
GO
