/* ============================================================
   migrate-scjl-report.sql — 2026-09-27 报工切 scjl(参考库原始口径)
   ------------------------------------------------------------
   用户拍板:报工数据落参考库生产记录表 scjl,按原始表关系关联——
   scjl.gd_id = plang_pc.id(精确到批次排产行)、scjl.gldh = plang_pc.pl_no;
   每次报工一行(参考库分批完工多行实证),审核即 wgzt='Y'+wgsj,
   弃审=软删;完工入库回写 scjl.post_no(参考库 §3.2 口径)。
   本脚本:scjl 加 批次号 nvarchar(12)(镜像 plang_pc.批次号,列表/追溯展示;
   关联本身靠 gd_id,不依赖本列)。存量 7 行历史数据不动。幂等可重跑。 ============================================================ */
SET NOCOUNT ON;
GO
-- 扩宽(nvarchar 字节数此前被误当字符数:sc_no 14字符装不下 MO-yyyy-MM-xxxx 15位;khdm 对齐 plang.khdm)
IF EXISTS (SELECT 1 FROM sys.columns c
           WHERE c.object_id = OBJECT_ID(N'dbo.scjl') AND c.name = N'sc_no' AND c.max_length < 56)
    ALTER TABLE dbo.scjl ALTER COLUMN sc_no nvarchar(28) NOT NULL;
IF EXISTS (SELECT 1 FROM sys.columns c
           WHERE c.object_id = OBJECT_ID(N'dbo.scjl') AND c.name = N'khdm' AND c.max_length < 80)
    ALTER TABLE dbo.scjl ALTER COLUMN khdm nvarchar(40) NULL;
IF COL_LENGTH(N'dbo.scjl', N'批次号') IS NULL
    ALTER TABLE dbo.scjl ADD [批次号] nvarchar(12) NULL;
GO
IF COL_LENGTH(N'dbo.scjl', N'批次号') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.major_id = OBJECT_ID(N'dbo.scjl')
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.scjl'), N'批次号', 'ColumnId')
                 AND ep.name = N'MS_Description')
        EXEC sp_updateextendedproperty N'MS_Description', N'批次号(镜像 plang_pc.批次号=转单日期 yyyyMMdd;关联锚点为 gd_id=plang_pc.id,本列仅供展示/检索)',
            N'SCHEMA', N'dbo', N'TABLE', N'scjl', N'COLUMN', N'批次号';
    ELSE
        EXEC sp_addextendedproperty N'MS_Description', N'批次号(镜像 plang_pc.批次号=转单日期 yyyyMMdd;关联锚点为 gd_id=plang_pc.id,本列仅供展示/检索)',
            N'SCHEMA', N'dbo', N'TABLE', N'scjl', N'COLUMN', N'批次号';
END
GO
PRINT N'scjl.批次号 就绪(幂等)';
GO
