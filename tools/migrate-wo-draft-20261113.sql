/* ============================================================
   migrate-wo-draft-20261113.sql — 2026-11-13(第二轮)
   新增「生产工单编制草稿」wo_draft_head / wo_draft_line(方案 A:保存草稿 + 整页编制 + 草稿箱)

   用户口径(2026-11-13 下午):
     「新建的生产工单如何实现保存草稿的情况呢?是否当前不能使用弹窗形式而是使用页面形式会更好呢?」
     → 拍板按方案 A:新建工单改**整页编制**、增加**保存草稿**、生产工单页增加**草稿箱**,
       草稿可继续编辑/删除/提交;提交时才生成正式工单。

   为什么草稿**不写 plang**(关键设计):
     plang 是外部单据表,任何一行都会立刻进入现役口径 ——
       · 快速排产「待排产池」= plang 里 生产线为空 + 未结案 + 未完工 的行(ScheduleBoardService.pending);
       · 生产工单列表、排产/领料/报工的「扫工单号」解析(resolveWoLine)都直接查 plang。
     草稿若写 plang,就会出现在待排产池、能被排产/领料/报工 = 假草稿。
     要直接写 plang 就得加"工单状态"列并改上面所有查询(改动面大 + plang 另有外部程序直写),不采用。

   ⇒ 草稿独立存两张表,提交时才调用 WorkOrderCreateService.create():
     ① wo_draft_head:草稿头(草稿号 GDD-yyyy-MM-nnnn / 状态 草稿|已提交 / 工单类型 /
        产品·客户·数量·日期·路线·备注 / 提交后回填正式工单号);
     ② wo_draft_line:临时工单用料行(与 wo_bom 行结构一致;草稿期允许不完整)。
     ③ 表 + 逐列 MS_Description 中文注明;草稿号唯一(软删不占唯一)+ 状态/时间索引 + 单头行序索引。
     ④ 权限不新增动作词:沿用生产工单页既有 create(「新增」)词(草稿保存/删除/提交同词)。

   幂等可重跑;两账套均执行(先正式、后测试)。
   ============================================================ */
SET NOCOUNT ON;
GO
IF OBJECT_ID(N'dbo.wo_draft_head', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.wo_draft_head (
        id            bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_wo_draft_head PRIMARY KEY,
        [草稿号]      nvarchar(30)    NOT NULL,
        [状态]        nvarchar(10)    NOT NULL CONSTRAINT DF_wo_draft_head_state DEFAULT (N'草稿'),
        [工单类型]    nvarchar(10)    NOT NULL CONSTRAINT DF_wo_draft_head_kind DEFAULT (N'常规'),
        [产品编码]    nvarchar(100)   NOT NULL,
        [产品名称]    nvarchar(200)   NULL,
        [规格型号]    nvarchar(200)   NULL,
        [计量单位]    nvarchar(20)    NULL,
        [客户编码]    nvarchar(40)    NULL,
        [客户名称]    nvarchar(200)   NULL,
        [订单数量]    decimal(18,4)   NULL,
        [生产数量]    decimal(18,4)   NULL,
        [工单日期]    date            NULL,
        [计划开工日期] date           NULL,
        [交期]        date            NULL,
        [工艺路线]    nvarchar(50)    NULL,
        [备注]        nvarchar(500)   NULL,
        [正式工单号]  nvarchar(50)    NULL,
        asp_user1     nvarchar(50)    NULL,
        asp_time1     datetime2(3)    NULL,
        asp_user2     nvarchar(50)    NULL,
        asp_time2     datetime2(3)    NULL,
        asp_cancel    nvarchar(1)     NOT NULL CONSTRAINT DF_wo_draft_head_cancel DEFAULT ('N')
    );
END
GO
IF OBJECT_ID(N'dbo.wo_draft_line', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.wo_draft_line (
        id          bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_wo_draft_line PRIMARY KEY,
        [单头id]    bigint          NOT NULL,
        [行序]      int             NOT NULL CONSTRAINT DF_wo_draft_line_seq DEFAULT (0),
        [子件编码]  nvarchar(100)   NOT NULL,
        [子件名称]  nvarchar(200)   NULL,
        [子件规格]  nvarchar(200)   NULL,
        [计量单位]  nvarchar(20)    NULL,
        [标准用量]  decimal(18,4)   NOT NULL CONSTRAINT DF_wo_draft_line_qty DEFAULT (0),
        [损耗量]    decimal(18,4)   NOT NULL CONSTRAINT DF_wo_draft_line_loss DEFAULT (0),
        [行备注]    nvarchar(500)   NULL,
        asp_user1   nvarchar(50)    NULL,
        asp_time1   datetime2(3)    NULL,
        asp_user2   nvarchar(50)    NULL,
        asp_time2   datetime2(3)    NULL,
        asp_cancel  nvarchar(1)     NOT NULL CONSTRAINT DF_wo_draft_line_cancel DEFAULT ('N')
    );
END
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_wo_draft_head_no'
               AND object_id = OBJECT_ID(N'dbo.wo_draft_head'))
    CREATE UNIQUE INDEX UX_wo_draft_head_no
        ON dbo.wo_draft_head([草稿号])
        WHERE asp_cancel = 'N';
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_wo_draft_head_state_time'
               AND object_id = OBJECT_ID(N'dbo.wo_draft_head'))
    CREATE INDEX IX_wo_draft_head_state_time
        ON dbo.wo_draft_head([状态], [asp_time2] DESC)
        INCLUDE ([草稿号], [工单类型], [产品编码], [产品名称]);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_wo_draft_line_head'
               AND object_id = OBJECT_ID(N'dbo.wo_draft_line'))
    CREATE INDEX IX_wo_draft_line_head
        ON dbo.wo_draft_line([单头id], [行序])
        INCLUDE ([子件编码], [标准用量]);
GO
-- ── 中文注明(表 + 逐列)──────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
               WHERE class = 1 AND major_id = OBJECT_ID(N'dbo.wo_draft_head')
                 AND minor_id = 0 AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description',
         N'生产工单编制草稿·头表(2026-11-13 方案 A):保存草稿用,草稿不写 plang(避免进入待排产/报工/领料);提交时调用 WorkOrderCreateService 生成正式工单并回填 正式工单号。一行=一张编制中的工单',
         N'SCHEMA', N'dbo', N'TABLE', N'wo_draft_head';
ELSE
    EXEC sp_updateextendedproperty N'MS_Description',
         N'生产工单编制草稿·头表(2026-11-13 方案 A):保存草稿用,草稿不写 plang(避免进入待排产/报工/领料);提交时调用 WorkOrderCreateService 生成正式工单并回填 正式工单号。一行=一张编制中的工单',
         N'SCHEMA', N'dbo', N'TABLE', N'wo_draft_head';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
               WHERE class = 1 AND major_id = OBJECT_ID(N'dbo.wo_draft_line')
                 AND minor_id = 0 AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description',
         N'生产工单编制草稿·临时工单用料行表(2026-11-13 方案 A):一行=草稿单头×一个子件;草稿期允许不完整,提交时按提交口径校验并写入正式临时用料 wo_bom',
         N'SCHEMA', N'dbo', N'TABLE', N'wo_draft_line';
ELSE
    EXEC sp_updateextendedproperty N'MS_Description',
         N'生产工单编制草稿·临时工单用料行表(2026-11-13 方案 A):一行=草稿单头×一个子件;草稿期允许不完整,提交时按提交口径校验并写入正式临时用料 wo_bom',
         N'SCHEMA', N'dbo', N'TABLE', N'wo_draft_line';
GO
DECLARE @cols TABLE (tbl sysname, col sysname, descr nvarchar(400));
INSERT INTO @cols (tbl, col, descr) VALUES
 (N'wo_draft_head', N'草稿号',       N'草稿号(GDD-yyyy-MM-nnnn;与正式工单 GD 号池分开,正式号只在提交时取)'),
 (N'wo_draft_head', N'状态',         N'状态(草稿/已提交;草稿箱只列「草稿」)'),
 (N'wo_draft_head', N'工单类型',     N'工单类型(常规/临时;临时=需要在本草稿维护子件用料)'),
 (N'wo_draft_head', N'产品编码',     N'主物料编码(草稿保存只强制这一项)'),
 (N'wo_draft_head', N'产品名称',     N'主物料名称(选中产品时回填快照)'),
 (N'wo_draft_head', N'规格型号',     N'主物料规格型号(快照)'),
 (N'wo_draft_head', N'计量单位',     N'主物料计量单位(快照)'),
 (N'wo_draft_head', N'客户编码',     N'客户编码(可空;提交时若填则校验存在)'),
 (N'wo_draft_head', N'客户名称',     N'客户名称(快照/展示)'),
 (N'wo_draft_head', N'订单数量',     N'订单数量(= plang.xq_sl;草稿期允许空/0)'),
 (N'wo_draft_head', N'生产数量',     N'生产数量(= plang.pl_sl;空/0 时提交按订单数量兜底)'),
 (N'wo_draft_head', N'工单日期',     N'工单日期(空=提交当天)'),
 (N'wo_draft_head', N'计划开工日期', N'计划开工日期(可空)'),
 (N'wo_draft_head', N'交期',         N'交期(= plang.cp_date;可空)'),
 (N'wo_draft_head', N'工艺路线',     N'工艺路线编码(草稿期不校审核;提交时校验「已审核」)'),
 (N'wo_draft_head', N'备注',         N'备注(提交时写 plang.bz,前缀「手工新增」/「手工新增·临时工单」)'),
 (N'wo_draft_head', N'正式工单号',   N'正式工单号(提交成功后回填,用于追溯草稿→工单)'),
 (N'wo_draft_head', N'asp_user1',    N'创建人'),
 (N'wo_draft_head', N'asp_time1',    N'创建时间'),
 (N'wo_draft_head', N'asp_user2',    N'最后修改人'),
 (N'wo_draft_head', N'asp_time2',    N'最后修改时间'),
 (N'wo_draft_head', N'asp_cancel',   N'作废标志(N=有效,Y=已删除/已提交后保留)'),
 (N'wo_draft_line', N'单头id',       N'单头id(= wo_draft_head.id)'),
 (N'wo_draft_line', N'行序',         N'行序(1..n;按提交顺序重排)'),
 (N'wo_draft_line', N'子件编码',     N'子件物料编码(提交时校验存在;用于生成 wo_bom)'),
 (N'wo_draft_line', N'子件名称',     N'子件名称(快照)'),
 (N'wo_draft_line', N'子件规格',     N'子件规格(快照)'),
 (N'wo_draft_line', N'计量单位',     N'计量单位(空时提交阶段按存货档案兜底)'),
 (N'wo_draft_line', N'标准用量',     N'标准用量(每 1 个成品的用量;草稿期允许 0,提交要求 >0)'),
 (N'wo_draft_line', N'损耗量',       N'损耗量(预留)'),
 (N'wo_draft_line', N'行备注',       N'行备注'),
 (N'wo_draft_line', N'asp_user1',    N'创建人'),
 (N'wo_draft_line', N'asp_time1',    N'创建时间'),
 (N'wo_draft_line', N'asp_user2',    N'最后修改人'),
 (N'wo_draft_line', N'asp_time2',    N'最后修改时间'),
 (N'wo_draft_line', N'asp_cancel',   N'作废标志(N=有效,Y=作废;草稿重新保存时旧行软删)');
DECLARE @tbl sysname, @col sysname, @descr nvarchar(400);
DECLARE cur CURSOR FOR SELECT tbl, col, descr FROM @cols;
OPEN cur;
FETCH NEXT FROM cur INTO @tbl, @col, @descr;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
                   WHERE ep.class = 1 AND ep.major_id = OBJECT_ID(N'dbo.' + @tbl)
                     AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.' + @tbl), @col, 'ColumnId')
                     AND ep.name = N'MS_Description')
        EXEC sp_addextendedproperty N'MS_Description', @descr,
             N'SCHEMA', N'dbo', N'TABLE', @tbl, N'COLUMN', @col;
    ELSE
        EXEC sp_updateextendedproperty N'MS_Description', @descr,
             N'SCHEMA', N'dbo', N'TABLE', @tbl, N'COLUMN', @col;
    FETCH NEXT FROM cur INTO @tbl, @col, @descr;
END
CLOSE cur;
DEALLOCATE cur;
GO
-- ── 自检 ──────────────────────────────────────────────────────────────
DECLARE @bad int = 0;
IF OBJECT_ID(N'dbo.wo_draft_head', N'U') IS NULL SET @bad = @bad + 1;
IF OBJECT_ID(N'dbo.wo_draft_line', N'U') IS NULL SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'PK_wo_draft_head'
               AND object_id = OBJECT_ID(N'dbo.wo_draft_head')) SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'PK_wo_draft_line'
               AND object_id = OBJECT_ID(N'dbo.wo_draft_line')) SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_wo_draft_head_no'
               AND object_id = OBJECT_ID(N'dbo.wo_draft_head')) SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_wo_draft_line_head'
               AND object_id = OBJECT_ID(N'dbo.wo_draft_line')) SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM sys.extended_properties
    WHERE class = 1 AND major_id = OBJECT_ID(N'dbo.wo_draft_head')
      AND minor_id > 0 AND name = N'MS_Description') < 22 SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM sys.extended_properties
    WHERE class = 1 AND major_id = OBJECT_ID(N'dbo.wo_draft_line')
      AND minor_id > 0 AND name = N'MS_Description') < 14 SET @bad = @bad + 1;
IF @bad > 0 RAISERROR(N'生产工单编制草稿(wo_draft_head/_line)自检失败(%d 项缺失)', 16, 1, @bad);
ELSE PRINT N'wo_draft_head / wo_draft_line 就绪(两表 + 主键/唯一/查询索引 + 逐列中文注明)';
GO
