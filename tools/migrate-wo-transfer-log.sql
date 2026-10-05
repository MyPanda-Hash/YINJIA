/* migrate-wo-transfer-log.sql(2026-10-05):工单调拨轨迹表 —— 9.29 生产管理批次 ②「工单调拨」
 *
 * 口径来源(会议):「生产线界面,选中工单 → 调拨到目标产线/车间;待加工列表与报工记录跟随转移,
 *   保留调拨轨迹」。落地:产线/车间两级目标(车间由 bs_prod_line.生产车间 派生,车间是产线的属性),
 *   每次调拨写一行轨迹(从/到 生产线·车间 + 数量 + 原因 + 操作人),工单追溯时间线可见;
 *   **可撤回**:撤销时把该行标 asp_cancel='Y'(留痕不删)+ 产线调回 从生产线。
 *
 * 表规范(数据库规范 §1.1/§2.1):wo_ 前缀 = 生产执行;主键 id + 审计四件套 asp_user1/2 + asp_time1/2;
 *   asp_cancel 取 nvarchar(1) 'Y'/'N';数量 decimal(18,4)。
 * 实现:WorkOrderTransferService(transfer / revoke);幂等可重跑;两账套均执行。
 */

IF OBJECT_ID('dbo.wo_transfer_log') IS NULL
CREATE TABLE dbo.wo_transfer_log (
  id          bigint IDENTITY(1,1) NOT NULL CONSTRAINT pk_wo_transfer_log PRIMARY KEY,
  pl_no       nvarchar(50)  NOT NULL,          -- 工单号
  pl_xc       int           NULL,              -- 工单行号
  批次号      nvarchar(50)  NULL,              -- 工单批次号(同一工单多批次时区分)
  plang_id    bigint        NULL,              -- 工单行 id(plang.id,精确到行)
  数量        decimal(18,4) NULL,              -- 本次调拨的排产数量
  从生产线    nvarchar(50)  NULL,
  从车间      nvarchar(50)  NULL,
  到生产线    nvarchar(50)  NULL,
  到车间      nvarchar(50)  NULL,
  原因        nvarchar(200) NULL,
  asp_user1   nvarchar(50)  NULL,              -- 调拨人
  asp_time1   datetime2     NULL CONSTRAINT df_wo_transfer_log_t1 DEFAULT (getdate()),
  asp_user2   nvarchar(50)  NULL,              -- 撤销人(asp_cancel='Y' 时)
  asp_time2   datetime2     NULL,              -- 撤销时间
  asp_cancel  nvarchar(1)   NULL CONSTRAINT df_wo_transfer_log_cancel DEFAULT (N'N')
);
GO

/* 查询索引:工单追溯按 工单号 取轨迹(含已撤销,故不带 asp_cancel 过滤列) */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_wo_transfer_log_pl_no' AND object_id = OBJECT_ID(N'dbo.wo_transfer_log'))
  CREATE INDEX ix_wo_transfer_log_pl_no ON dbo.wo_transfer_log (pl_no, id);
GO

/* ============ 中文注明(全量部署规范:新表与关键列必须带 MS_Description) ============ */
DECLARE @tbl sysname = N'wo_transfer_log';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.major_id = OBJECT_ID(N'dbo.' + @tbl) AND ep.minor_id = 0 AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'工单调拨轨迹(9.29 批次②:每次调拨一行,从/到 生产线·车间 + 数量 + 原因;撤销=asp_cancel Y 并调回原线)',
       N'SCHEMA', N'dbo', N'TABLE', @tbl;

DECLARE @cols TABLE (col sysname, cmt nvarchar(300));
INSERT INTO @cols VALUES
 (N'pl_no',     N'工单号(plang.pl_no)'),
 (N'pl_xc',     N'工单行号(plang.pl_xc)'),
 (N'批次号',    N'工单批次号(同一工单多批次时区分调拨对象)'),
 (N'plang_id',  N'工单行 id(=plang.id,精确到行)'),
 (N'数量',      N'本次调拨的排产数量'),
 (N'从生产线',  N'调拨前生产线(撤销时调回此线)'),
 (N'从车间',    N'调拨前所属车间(=bs_prod_line.生产车间)'),
 (N'到生产线',  N'调拨后生产线'),
 (N'到车间',    N'调拨后所属车间'),
 (N'原因',      N'调拨原因(人工填写)'),
 (N'asp_user1', N'调拨人'),
 (N'asp_user2', N'撤销人(asp_cancel=Y 时写入)'),
 (N'asp_cancel',N'撤销标记 Y/N(留痕不删:撤销后轨迹仍可查)');
DECLARE @c sysname, @m nvarchar(300);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT col, cmt FROM @cols;
OPEN cur FETCH NEXT FROM cur INTO @c, @m;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
                 WHERE ep.major_id = OBJECT_ID(N'dbo.' + @tbl)
                   AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.' + @tbl), @c, 'ColumnId')
                   AND ep.name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', @m, N'SCHEMA', N'dbo', N'TABLE', @tbl, N'COLUMN', @c;
  FETCH NEXT FROM cur INTO @c, @m;
END
CLOSE cur DEALLOCATE cur;
GO

/* ============ 自检 ============ */
IF OBJECT_ID('dbo.wo_transfer_log') IS NULL
  RAISERROR(N'wo_transfer_log 未建成', 16, 1);
ELSE IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.wo_transfer_log'))
  RAISERROR(N'wo_transfer_log 缺中文注明', 16, 1);
ELSE PRINT N'wo_transfer_log 就绪(工单调拨轨迹)';
GO
