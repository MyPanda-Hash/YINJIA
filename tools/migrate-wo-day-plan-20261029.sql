/* ============================================================
   migrate-wo-day-plan-20261029.sql — 2026-10-29
   工单日排产(生产工单 / 工单排产 两页表格内的「日排产」列)落库

   用户口径(2026-10-29,附《成型车间排单计划》纸质报表 + 生产工单页截图):
     「生产工单中需要能实现对后面日期的排产量设定，或者根据设定完工日期和数量配置每天需要
      完成的数量……就是在当前的表格内容处插入当前设定的日排产数量，修改需要针对当前生产工单
      和工单排产中都要实现」，并明确「不要另开一张表（页面），就在原有表格上加列」。
   ⇒ 页面**不新增任何表格/块**：生产工单(WORK_ORDER_LIST)、工单排产(WORK_ORDER_BOARD)
     都已在自己的明细表里追加「日期列」；本表只做**后端存储**（手填的计划要有地方落库）。

   本脚本:
     ① 新建 wo_day_plan(工单行id × 工序 × 计划日期 → 计划数量);
     ② 表 + 逐列 MS_Description 中文注明;
     ③ 唯一键(同一行同一工序同一天一格,软删不占唯一)+ 日期/产线查询索引;
     ④ 两个页面面板各加动作词 dayplan(「日排产」),授予已有查看权的角色。

   ⚠ 为什么键里带「工序」:同一张工单行会依次走 成型/切炭/组装,各道计划量与报工口径不同
     (成型支数 ≠ 装箱数),日计划必须按道分开;生产工单页取该行「当前工序」,工单排产页取
     所选产线的工序。

   幂等可重跑;两账套均执行(先正式、后测试)。
   ============================================================ */
SET NOCOUNT ON;
GO
IF OBJECT_ID(N'dbo.wo_day_plan', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.wo_day_plan (
        id          bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_wo_day_plan PRIMARY KEY,
        [工单行id]  bigint          NOT NULL,
        [工单号]    nvarchar(100)   NOT NULL,
        [工单行号]  int             NULL,
        [工序]      nvarchar(100)   NOT NULL CONSTRAINT DF_wo_day_plan_op DEFAULT (N''),
        [计划日期]  date            NOT NULL,
        [计划数量]  decimal(18,4)   NOT NULL CONSTRAINT DF_wo_day_plan_qty DEFAULT (0),
        [生产线]    nvarchar(100)   NULL,
        [备注]      nvarchar(400)   NULL,
        asp_user1   nvarchar(100)   NULL,
        asp_time1   datetime2(3)    NULL,
        asp_user2   nvarchar(100)   NULL,
        asp_time2   datetime2(3)    NULL,
        asp_cancel  char(1)         NOT NULL CONSTRAINT DF_wo_day_plan_cancel DEFAULT ('N')
    );
END
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_wo_day_plan_row_op_date'
               AND object_id = OBJECT_ID(N'dbo.wo_day_plan'))
    CREATE UNIQUE INDEX UX_wo_day_plan_row_op_date
        ON dbo.wo_day_plan([工单行id], [工序], [计划日期])
        WHERE asp_cancel = 'N';
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_wo_day_plan_date'
               AND object_id = OBJECT_ID(N'dbo.wo_day_plan'))
    CREATE INDEX IX_wo_day_plan_date
        ON dbo.wo_day_plan([计划日期])
        INCLUDE ([工单行id], [工序], [计划数量], [生产线]);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_wo_day_plan_line_date'
               AND object_id = OBJECT_ID(N'dbo.wo_day_plan'))
    CREATE INDEX IX_wo_day_plan_line_date
        ON dbo.wo_day_plan([生产线], [计划日期]);
GO
-- ── 中文注明(表 + 逐列)──────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
               WHERE class = 1 AND major_id = OBJECT_ID(N'dbo.wo_day_plan')
                 AND minor_id = 0 AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description',
         N'工单日排产(生产工单/工单排产两页表格内的日期列):工单行×工序×计划日期的计划数量;实际完成量仍取报工 scjl(已审核 wgzt=Y,含手机端吸收),两账不合一',
         N'SCHEMA', N'dbo', N'TABLE', N'wo_day_plan';
ELSE
    EXEC sp_updateextendedproperty N'MS_Description',
         N'工单日排产(生产工单/工单排产两页表格内的日期列):工单行×工序×计划日期的计划数量;实际完成量仍取报工 scjl(已审核 wgzt=Y,含手机端吸收),两账不合一',
         N'SCHEMA', N'dbo', N'TABLE', N'wo_day_plan';
GO
DECLARE @cols TABLE (col sysname, descr nvarchar(400));
INSERT INTO @cols (col, descr) VALUES
 (N'工单行id', N'工单行id(= plang.id;经 plang_pc.plang_id 与报工 scjl.gd_id 对齐)'),
 (N'工单号',   N'工单号(冗余展示列,与 plang.pl_no 同源)'),
 (N'工单行号', N'工单行号(冗余展示列,与 plang.pl_xc 同源)'),
 (N'工序',     N'工序(成型/切炭/组装…;生产工单页=该行当前工序,工单排产页=所选产线工序)'),
 (N'计划日期', N'计划日期(自然日)'),
 (N'计划数量', N'计划数量(当天这一道工序计划做多少;0/作废=未排)'),
 (N'生产线',   N'生产线(设置计划时所在产线快照)'),
 (N'备注',     N'备注'),
 (N'asp_user1', N'创建人'),
 (N'asp_time1', N'创建时间'),
 (N'asp_user2', N'最后修改人'),
 (N'asp_time2', N'最后修改时间'),
 (N'asp_cancel', N'作废标志(N=有效,Y=作废;清空该格=软删)');
DECLARE @col sysname, @descr nvarchar(400);
DECLARE cur CURSOR FOR SELECT col, descr FROM @cols;
OPEN cur;
FETCH NEXT FROM cur INTO @col, @descr;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
                   WHERE ep.class = 1 AND ep.major_id = OBJECT_ID(N'dbo.wo_day_plan')
                     AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.wo_day_plan'), @col, 'ColumnId')
                     AND ep.name = N'MS_Description')
        EXEC sp_addextendedproperty N'MS_Description', @descr,
             N'SCHEMA', N'dbo', N'TABLE', N'wo_day_plan', N'COLUMN', @col;
    ELSE
        EXEC sp_updateextendedproperty N'MS_Description', @descr,
             N'SCHEMA', N'dbo', N'TABLE', N'wo_day_plan', N'COLUMN', @col;
    FETCH NEXT FROM cur INTO @col, @descr;
END
CLOSE cur;
DEALLOCATE cur;
GO
-- ── 页面动作词「日排产」(dayplan):生产工单 + 工单排产 两页,授予已有查看权的角色 ──
UPDATE rp
   SET rp.perms = rp.perms + N',dayplan'
  FROM dbo.yj_role_panel rp
 WHERE rp.panel_code IN (N'WORK_ORDER_BOARD', N'WORK_ORDER_LIST')
   AND ISNULL(rp.perms, N'') LIKE N'%view%'
   AND ISNULL(rp.perms, N'') NOT LIKE N'%dayplan%';
GO
-- ── 自检 ──────────────────────────────────────────────────────────────
DECLARE @bad int = 0;
IF OBJECT_ID(N'dbo.wo_day_plan', N'U') IS NULL SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_wo_day_plan_row_op_date'
               AND object_id = OBJECT_ID(N'dbo.wo_day_plan')) SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM sys.extended_properties
    WHERE class = 1 AND major_id = OBJECT_ID(N'dbo.wo_day_plan')
      AND minor_id > 0 AND name = N'MS_Description') < 13 SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM dbo.yj_role_panel WHERE panel_code = N'WORK_ORDER_BOARD'
               AND perms LIKE N'%dayplan%') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM dbo.yj_role_panel WHERE panel_code = N'WORK_ORDER_LIST'
               AND perms LIKE N'%dayplan%') SET @bad = @bad + 1;
IF @bad > 0 RAISERROR(N'工单日排产(wo_day_plan)自检失败(%d 项缺失)', 16, 1, @bad);
ELSE PRINT N'wo_day_plan 就绪(表 + 唯一/查询索引 + 逐列中文注明 + 两页 dayplan 授权)';
GO
