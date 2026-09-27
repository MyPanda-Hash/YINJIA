/* ============================================================
   migrate-plang-schedule.sql — 2026-09-27 快速排产切 plang 配套
   ------------------------------------------------------------
   plang.lb(类别,legacy 实存班次)扩宽 nvarchar(2字符)→nvarchar(10字符):
   快速排产「排产班组」写入 lb(bs_team 班组名如 下料班 3 字放不下)。
   幂等可重跑。 ============================================================ */
SET NOCOUNT ON;
GO
IF EXISTS (SELECT 1 FROM sys.columns c
           WHERE c.object_id = OBJECT_ID(N'dbo.plang') AND c.name = N'lb' AND c.max_length < 20)
    ALTER TABLE dbo.plang ALTER COLUMN lb nvarchar(10) NULL;
GO
IF COL_LENGTH(N'dbo.plang', N'lb') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.major_id = OBJECT_ID(N'dbo.plang')
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.plang'), N'lb', 'ColumnId')
                 AND ep.name = N'MS_Description')
        EXEC sp_updateextendedproperty N'MS_Description', N'类别/班次(快速排产:排产班组名,legacy 原义 班次 白班/夜班)',
            N'SCHEMA', N'dbo', N'TABLE', N'plang', N'COLUMN', N'lb';
    ELSE
        EXEC sp_addextendedproperty N'MS_Description', N'类别/班次(快速排产:排产班组名,legacy 原义 班次 白班/夜班)',
            N'SCHEMA', N'dbo', N'TABLE', N'plang', N'COLUMN', N'lb';
END
GO
PRINT N'plang.lb 扩宽就绪(幂等)';
GO
