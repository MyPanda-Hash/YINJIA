/* ============================================================
   migrate-plang-batch.sql — 2026-09-27 plang 加「批次号」(分批转单按日期分批)
   ------------------------------------------------------------
   用户拍板:同一订单行分批转单,按**转单日期**分批次——批次号=yyyyMMdd;
   不同日期=不同批次行(可区分);同一天同行号=同批次,累加数量不插行。
   行键演化为 工单号 pl_no + 工单行号 pl_xc + 批次号。
   存量回填:批次号=pl_date 的 yyyyMMdd。幂等可重跑。 ============================================================ */
SET NOCOUNT ON;
GO
IF COL_LENGTH(N'dbo.plang', N'批次号') IS NULL
    ALTER TABLE dbo.plang ADD [批次号] nvarchar(8) NULL;
GO
IF COL_LENGTH(N'dbo.plang', N'批次号') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.major_id = OBJECT_ID(N'dbo.plang')
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.plang'), N'批次号', 'ColumnId')
                 AND ep.name = N'MS_Description')
        EXEC sp_updateextendedproperty N'MS_Description', N'批次号(转单日期 yyyyMMdd:同一订单行不同日期分批转单=不同批次行;同日同批累加不插行)',
            N'SCHEMA', N'dbo', N'TABLE', N'plang', N'COLUMN', N'批次号';
    ELSE
        EXEC sp_addextendedproperty N'MS_Description', N'批次号(转单日期 yyyyMMdd:同一订单行不同日期分批转单=不同批次行;同日同批累加不插行)',
            N'SCHEMA', N'dbo', N'TABLE', N'plang', N'COLUMN', N'批次号';
END
GO
-- 存量回填(幂等:只补 NULL;= 单据日期 pl_date 的 yyyyMMdd,CONVERT style 112 即 yyyyMMdd)
UPDATE plang SET [批次号] = CONVERT(varchar(8), pl_date, 112)
WHERE [批次号] IS NULL AND pl_date IS NOT NULL;
GO
PRINT N'plang.批次号 就绪(列+注明+回填,幂等)';
GO
