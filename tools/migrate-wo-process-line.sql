/* migrate-wo-process-line.sql(2026-10-07 恢复/升级版):工序—产线预排台账(排产时**人工**定全程线 + 报工转序)
 *
 * 用户口径(2026-10-07):「在快速排产内,一开始就对当前工单的**工序路线全部排产** —— 把好几道工序的生产线
 *   一次选好(**和现在选线的方式一样,人工选**);完成一个工序就进入下一个工序的生产线」。
 *   ⚠ 与 2026-10-05 首版实现(后被 migrate-wo-process-line-drop.sql 以「不应该预排产」DROP)的区别:
 *     **计划线由人工在排产时逐道选定**,不再由系统按"最闲线"自动预排。
 * 载体:一张**小台账**(不做头行单据,沿用 wo_ 前缀):一行 = 一(工单 × 工序)。
 *   · 计划生产线 = 排产时人工逐道选定(可再改);实际生产线 = 转序落实时写入(同步 plang.scx);
 *   · 首道:排产提交即「已落实」(它就是工单当前排产线);其余道 状态=计划,前道报工完工后自动转序;
 *   · **撤销排产时必须同时作废本台账**(否则出现"没排产却有计划线")。
 * 撤回:DROP TABLE wo_process_line(见 migrate-wo-process-line-drop.sql,该脚本**不在迁移链**里,手动执行)。
 * 幂等可重跑;两账套均执行。
 */
SET NOCOUNT ON;
GO

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
  计划完工日期 date          NULL,
  状态         nvarchar(20)  NULL,
  落实时间     datetime      NULL,
  备注         nvarchar(200) NULL,
  asp_user1    nvarchar(50)  NULL, asp_time1 datetime NULL,
  asp_user2    nvarchar(50)  NULL, asp_time2 datetime NULL,
  asp_cancel   char(1)       NULL CONSTRAINT DF_wo_process_line_cancel DEFAULT ('N')
);
GO
-- 兼容 2026-10-05 首版建的表(没有 计划完工日期):补列
IF OBJECT_ID(N'dbo.wo_process_line', N'U') IS NOT NULL AND COL_LENGTH('wo_process_line', N'计划完工日期') IS NULL
  ALTER TABLE wo_process_line ADD [计划完工日期] date NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name=N'ix_wo_process_line' AND object_id=OBJECT_ID(N'dbo.wo_process_line'))
  CREATE INDEX ix_wo_process_line ON dbo.wo_process_line (工单号, 工序序);
GO
DECLARE @tbl sysname = N'wo_process_line', @cmt nvarchar(200);
SET @cmt = N'工序—产线预排台账:一行一(工单×工序);计划生产线=排产时人工按工艺路线逐道选定的线,实际生产线=报工完工转序时落实的线';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.'+@tbl) AND minor_id=0 AND name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', @cmt, N'SCHEMA',N'dbo',N'TABLE',@tbl;
DECLARE @cols TABLE (c sysname, m nvarchar(200));
INSERT INTO @cols VALUES
 (N'工单号', N'工单号(plang.pl_no)'),
 (N'工单行id', N'工单行(plang.id);空=整单级预排'),
 (N'工序', N'工序名称(取自工艺路线明细)'),
 (N'工序序', N'工序顺序(工艺路线 加工顺序,1=首道)'),
 (N'计划生产线', N'预排线:排产时人工逐道选定,可再改'),
 (N'实际生产线', N'实际线:转序落实时写入(同步到 plang.scx)'),
 (N'计划数量', N'该道工序的换算后计划量(只读,按工艺路线换算率算)'),
 (N'计划完工日期', N'该道计划完工日(默认取工单交期)'),
 (N'状态', N'计划/已落实/已完工'),
 (N'落实时间', N'转序落实时间'),
 (N'备注', N'备注');
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