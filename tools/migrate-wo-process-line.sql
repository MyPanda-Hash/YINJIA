/* migrate-wo-process-line.sql(2026-10-05):工序—产线预排台账(排产时定全程线 + 转序落实)
 *
 * 用户口径:「开始排线时根据当前工序排线,整个工单定好线;完成一步后为下一步派新线」
 *   ⇒ 采用「**预排 + 转序确认(默认沿用预排线)**」:排产时按工艺路线给各道工序一条**计划线**,
 *     每到转序(前道报工完工)时把下一道的计划线**落实为当前线**(写 plang.scx),差异走 wo_transfer_log 留痕、可撤回。
 * 载体:一张**小台账**(不做头行单据,沿用 wo_ 前缀):一行 = 一(工单 × 工序)。
 * 撤回:DROP TABLE wo_process_line;  (纯新增表,不影响既有数据)
 * 幂等可重跑;两账套均执行。
 */
IF OBJECT_ID(N'dbo.wo_process_line', N'U') IS NULL
CREATE TABLE dbo.wo_process_line (
  id           bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_wo_process_line PRIMARY KEY,
  工单号       nvarchar(50)  NOT NULL,
  工单行id     bigint        NULL,
  工序         nvarchar(50)  NOT NULL,
  工序序       int           NULL,
  计划生产线   nvarchar(50)  NULL,
  实际生产线   nvarchar(50)  NULL,
  计划数量     decimal(18,4) NULL,
  状态         nvarchar(20)  NULL,
  落实时间     datetime      NULL,
  备注         nvarchar(200) NULL,
  asp_user1    nvarchar(50)  NULL, asp_time1 datetime NULL,
  asp_user2    nvarchar(50)  NULL, asp_time2 datetime NULL,
  asp_cancel   char(1)       NULL CONSTRAINT DF_wo_process_line_cancel DEFAULT ('N')
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name=N'ix_wo_process_line' AND object_id=OBJECT_ID(N'dbo.wo_process_line'))
  CREATE INDEX ix_wo_process_line ON dbo.wo_process_line (工单号, 工序序);
GO
DECLARE @tbl sysname = N'wo_process_line', @cmt nvarchar(200);
SET @cmt = N'工序—产线预排台账:一行一(工单×工序);计划生产线=排产时按路线预排的线,实际生产线=转序时落实的线';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.'+@tbl) AND minor_id=0 AND name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', @cmt, N'SCHEMA',N'dbo',N'TABLE',@tbl;
DECLARE @cols TABLE (c sysname, m nvarchar(200));
INSERT INTO @cols VALUES
 (N'工单号', N'工单号(plang.pl_no)'),
 (N'工单行id', N'工单行(plang.id);空=整单级预排'),
 (N'工序', N'工序名称(取自工艺路线明细)'),
 (N'工序序', N'工序顺序(工艺路线 加工顺序)'),
 (N'计划生产线', N'预排线:排产时按路线预置,可人工改'),
 (N'实际生产线', N'实际线:转序落实时写入(同步到 plang.scx)'),
 (N'计划数量', N'该道工序的换算后计划量'),
 (N'状态', N'计划/已落实/已完工'),
 (N'落实时间', N'转序落实时间');
DECLARE @c sysname, @m nvarchar(200);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT c, m FROM @cols;
OPEN cur FETCH NEXT FROM cur INTO @c, @m;
WHILE @@FETCH_STATUS=0
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.'+@tbl)
                 AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.'+@tbl),@c,'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', @m, N'SCHEMA',N'dbo',N'TABLE',@tbl,N'COLUMN',@c;
  FETCH NEXT FROM cur INTO @c, @m;
END
CLOSE cur DEALLOCATE cur;
GO
IF OBJECT_ID(N'dbo.wo_process_line', N'U') IS NULL RAISERROR(N'工序—产线预排台账建表失败',16,1);
ELSE PRINT N'工序—产线预排台账就绪:wo_process_line(可 DROP 回滚)';
GO