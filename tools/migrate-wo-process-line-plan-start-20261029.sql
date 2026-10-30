/* ============================================================
   migrate-wo-process-line-plan-start-20261029.sql — 2026-10-29
   工序台账(wo_process_line)补「计划开工日期」—— 计划链:上一道计划完工日 = 下一道计划开工日

   用户口径(2026-10-29,附工序路线排线弹窗截图):
     「就在当前我这个排产选产线的位置增加开工日期,增加到计划完工日期左边;上一条计划完工日期的时间
      就是当前排产第二条工序的开工日期。而实际的开工日期要在当前实际的完工日期时间处进行……
      计划时间和实际时间不会一致」。
   ⇒ 工序路线排线要能填「计划开工日期」,并据此 + 计划数量 生成每日计划(wo_day_plan);
     实际开工 = 上一道实际完工时间(落库进 落实时间,不写死在"看板打开那一刻")。

   本脚本只加 1 列,幂等;两账套均执行。
   ============================================================ */
SET NOCOUNT ON;
GO
IF OBJECT_ID(N'dbo.wo_process_line', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wo_process_line', N'计划开工日期') IS NULL
    ALTER TABLE dbo.wo_process_line ADD [计划开工日期] date NULL;
GO
IF COL_LENGTH(N'dbo.wo_process_line', N'计划开工日期') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.class = 1 AND ep.major_id = OBJECT_ID(N'dbo.wo_process_line')
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.wo_process_line'), N'计划开工日期', 'ColumnId')
                 AND ep.name = N'MS_Description')
        EXEC sp_updateextendedproperty N'MS_Description',
             N'计划开工日期(工序路线排线时人工给定;默认上一道计划完工日期 = 下一道计划开工日期;与计划完工日期一起决定日排产均摊天数)',
             N'SCHEMA', N'dbo', N'TABLE', N'wo_process_line', N'COLUMN', N'计划开工日期';
    ELSE
        EXEC sp_addextendedproperty N'MS_Description',
             N'计划开工日期(工序路线排线时人工给定;默认上一道计划完工日期 = 下一道计划开工日期;与计划完工日期一起决定日排产均摊天数)',
             N'SCHEMA', N'dbo', N'TABLE', N'wo_process_line', N'COLUMN', N'计划开工日期';
END
GO
DECLARE @bad int = 0;
IF COL_LENGTH(N'dbo.wo_process_line', N'计划开工日期') IS NULL SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class = 1
               AND ep.major_id = OBJECT_ID(N'dbo.wo_process_line')
               AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.wo_process_line'), N'计划开工日期', 'ColumnId')
               AND ep.name = N'MS_Description') SET @bad = @bad + 1;
IF @bad > 0 RAISERROR(N'工序台账「计划开工日期」自检失败(%d 项缺失)', 16, 1, @bad);
ELSE PRINT N'wo_process_line.计划开工日期 就绪(列 + 中文注明)';
GO
