/* migrate-plang-report-state.sql(2026-10-05):工单状态字段(由工序报工审核/弃审回写)
 *
 * 用户口径:「报工需要能影响当前的工单情况」⇒ 报工过账后把派生状态**落到工单行**上,
 *   让工单列表/详情/排产直接读到"走到哪、做完了没",而不必每次重算。
 *   四列:当前工序 / 当前工序完工量 / 完工状态(未开工·在制·生产完工) / 完工时间。
 *   口径:完工状态 = 未开工(无已审核报工) → 在制 → **生产完工**(工艺路线**末道**工序完工量 ≥ Σ计划量);
 *        弃审报工会把它退回(完工时间清空) ⇒ 可撤回。
 * 撤回:ALTER TABLE plang DROP COLUMN [当前工序],[当前工序完工量],[完工状态],[完工时间]; 幂等;两账套均执行。
 */
IF COL_LENGTH('plang', N'当前工序') IS NULL ALTER TABLE plang ADD [当前工序] nvarchar(50) NULL;
IF COL_LENGTH('plang', N'当前工序完工量') IS NULL ALTER TABLE plang ADD [当前工序完工量] decimal(18,4) NULL;
IF COL_LENGTH('plang', N'完工状态') IS NULL ALTER TABLE plang ADD [完工状态] nvarchar(20) NULL;
IF COL_LENGTH('plang', N'完工时间') IS NULL ALTER TABLE plang ADD [完工时间] datetime NULL;
GO
DECLARE @c TABLE (col sysname, cmt nvarchar(300));
INSERT INTO @c VALUES
 (N'当前工序',       N'当前工序:按工单工艺路线+已审核报工推导(末道有完工量的那道);报工审核回写、弃审回退'),
 (N'当前工序完工量', N'当前工序完工量:该工序已审核报工数量合计'),
 (N'完工状态',       N'完工状态:未开工/在制/生产完工(路线末道工序完工量≥Σ计划量);报工审核回写、弃审回退'),
 (N'完工时间',       N'完工时间:首次达到"生产完工"的时刻;弃审回退时清空');
DECLARE @col sysname, @cmt nvarchar(300);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT col, cmt FROM @c;
OPEN cur FETCH NEXT FROM cur INTO @col, @cmt;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.plang')
                 AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang'), @col, 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', @cmt, N'SCHEMA', N'dbo', N'TABLE', N'plang', N'COLUMN', @col;
  FETCH NEXT FROM cur INTO @col, @cmt;
END
CLOSE cur DEALLOCATE cur;
GO
IF COL_LENGTH('plang', N'完工状态') IS NULL RAISERROR(N'工单状态列创建失败', 16, 1);
ELSE PRINT N'工单状态列就绪:当前工序/当前工序完工量/完工状态/完工时间';
GO