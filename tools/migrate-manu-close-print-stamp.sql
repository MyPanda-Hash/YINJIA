-- migrate-manu-close-print-stamp.sql — 工单明细(工单排产看板)补 结案/打印 留痕四列(2026-09-23)
-- 依据:旧系统 工单排产明细.列表(ProSchedList)字段对齐——用户 2026-09-23 提供:
--   结案人/结案时间(结案留痕,取消结案回退时清空)、打印人/打印时间(生产任务单最近一次打印留痕;
--   打印次数列已有,只计数不记人,补齐后与旧系统 列表列 一致)。
-- 留痕落点:ManuCloseHandler(结案/取消结案)、/px/scheduleBoard/printStamp(打印工单) 写入;
-- 展示落点:工单排产看板 WorkOrderBoard 明细列 + 追溯弹窗(不进 MANU_ORDER 表单,系统戳不占表单位)。
-- 幂等:COL_LENGTH / IF NOT EXISTS,可重复执行。
SET NOCOUNT ON;

IF COL_LENGTH('bd_manu_order', N'结案人') IS NULL ALTER TABLE bd_manu_order ADD [结案人] nvarchar(40) NULL;
IF COL_LENGTH('bd_manu_order', N'结案时间') IS NULL ALTER TABLE bd_manu_order ADD [结案时间] datetime2 NULL;
IF COL_LENGTH('bd_manu_order', N'打印人') IS NULL ALTER TABLE bd_manu_order ADD [打印人] nvarchar(40) NULL;
IF COL_LENGTH('bd_manu_order', N'打印时间') IS NULL ALTER TABLE bd_manu_order ADD [打印时间] datetime2 NULL;

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.major_id = OBJECT_ID('bd_manu_order')
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('bd_manu_order'), N'结案人', 'ColumnId')
                 AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'结案人(执行「结案」的操作员;取消结案时清空。旧系统 ProSchedList 列表列)',
       N'SCHEMA', N'dbo', N'TABLE', N'bd_manu_order', N'COLUMN', N'结案人';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.major_id = OBJECT_ID('bd_manu_order')
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('bd_manu_order'), N'结案时间', 'ColumnId')
                 AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'结案时间(「结案」落库时刻;取消结案时清空)',
       N'SCHEMA', N'dbo', N'TABLE', N'bd_manu_order', N'COLUMN', N'结案时间';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.major_id = OBJECT_ID('bd_manu_order')
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('bd_manu_order'), N'打印人', 'ColumnId')
                 AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'打印人(最近一次打印生产任务单的操作员;旧系统 ProSchedList 列表列)',
       N'SCHEMA', N'dbo', N'TABLE', N'bd_manu_order', N'COLUMN', N'打印人';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.major_id = OBJECT_ID('bd_manu_order')
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('bd_manu_order'), N'打印时间', 'ColumnId')
                 AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'打印时间(最近一次打印生产任务单的时刻;与 打印次数/打印人 配套)',
       N'SCHEMA', N'dbo', N'TABLE', N'bd_manu_order', N'COLUMN', N'打印时间';

SELECT N'新列' AS 检查, COUNT(*) AS n FROM sys.columns WHERE object_id=OBJECT_ID('bd_manu_order')
  AND name IN (N'结案人', N'结案时间', N'打印人', N'打印时间');
PRINT N'migrate-manu-close-print-stamp 完成';
GO
