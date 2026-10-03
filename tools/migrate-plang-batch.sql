/* ============================================================
   migrate-plang-batch.sql — 2026-09-27 plang 加「批次号」(每次转单各自成批)
   ------------------------------------------------------------
   用户拍板(终版):批次号 = 转单日期 yyyyMMdd,同一天多次转单各自成批,
   依次 -2/-3 后缀(每日重新起算);不再同批累加——每次转单=新批次行。
   行键 = 工单号 pl_no + 工单行号 pl_xc + 批次号(如 20260927、20260927-2)。
   存量回填:批次号=pl_date 的 yyyyMMdd。列宽 nvarchar(12)(容纳 -N 后缀)。
   幂等可重跑(含 8→12 扩宽守卫)。 ============================================================ */
SET NOCOUNT ON;
GO
IF COL_LENGTH(N'dbo.plang', N'批次号') IS NULL
    ALTER TABLE dbo.plang ADD [批次号] nvarchar(12) NULL;
GO
-- 扩宽守卫(首版建为 nvarchar(8),容纳 "-N" 后缀需 12)
IF EXISTS (SELECT 1 FROM sys.columns c
           WHERE c.object_id = OBJECT_ID(N'dbo.plang') AND c.name = N'批次号' AND c.max_length < 24)
    ALTER TABLE dbo.plang ALTER COLUMN [批次号] nvarchar(12) NULL;
GO
IF COL_LENGTH(N'dbo.plang', N'批次号') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.major_id = OBJECT_ID(N'dbo.plang')
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.plang'), N'批次号', 'ColumnId')
                 AND ep.name = N'MS_Description')
        EXEC sp_updateextendedproperty N'MS_Description', N'批次号(转单日期 yyyyMMdd;同一天多次转单各自成批依次 -2/-3 后缀,每日重新起算;每次转单=新批次行)',
            N'SCHEMA', N'dbo', N'TABLE', N'plang', N'COLUMN', N'批次号';
    ELSE
        EXEC sp_addextendedproperty N'MS_Description', N'批次号(转单日期 yyyyMMdd;同一天多次转单各自成批依次 -2/-3 后缀,每日重新起算;每次转单=新批次行)',
            N'SCHEMA', N'dbo', N'TABLE', N'plang', N'COLUMN', N'批次号';
END
GO
-- 存量回填(幂等:只补 NULL;= 单据日期 pl_date 的 yyyyMMdd,CONVERT style 112 即 yyyyMMdd)
UPDATE plang SET [批次号] = CONVERT(varchar(8), pl_date, 112)
WHERE [批次号] IS NULL AND pl_date IS NOT NULL;
GO
PRINT N'plang.批次号 就绪(列宽12+注明+回填,幂等)';
GO
