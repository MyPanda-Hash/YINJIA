-- migrate-widen-dm-cols.sql — 往来单位编码列 dm 加宽:dm_gf/dm_kh 由 legacy 窄列加宽到 nvarchar(50)
-- 根因:dm_gf.dm 为 legacy 建表 nvarchar(16)(8字符),金蝶同步的供应商编码
--      (如 YJ-KG-JBE=9字符、YJ-XMHYX-001=12字符)超宽,同步报
--      "String or binary data would be truncated",2026-09-15 全量同步供应商 151 条失败 2 条。
--      dm_kh.dm 为 nvarchar(20)(10字符),同为 legacy 窄列,防御性一并加宽。
-- 修法:加宽到 nvarchar(50)(与单据编号类列一致;无索引依赖,直接 ALTER)。
-- 幂等:仅在列宽不足时执行,可重复。
SET NOCOUNT ON;
GO
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.dm_gf') AND name = 'dm' AND max_length < 100)
BEGIN
    ALTER TABLE dbo.dm_gf ALTER COLUMN dm nvarchar(50) NOT NULL;
    PRINT N'dm_gf.dm 已加宽 nvarchar(16)→nvarchar(50)';
END
GO
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.dm_kh') AND name = 'dm' AND max_length < 100)
BEGIN
    ALTER TABLE dbo.dm_kh ALTER COLUMN dm nvarchar(50) NOT NULL;
    PRINT N'dm_kh.dm 已加宽 nvarchar(20)→nvarchar(50)';
END
GO
-- 列中文注明(幂等)
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('dbo.dm_gf') AND minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.dm_gf'), 'dm', 'ColumnId') AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'供应商编码(金蝶同步锚点之一,与外部数据ID共同幂等)', N'SCHEMA', N'dbo', N'TABLE', N'dm_gf', N'COLUMN', N'dm';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('dbo.dm_kh') AND minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.dm_kh'), 'dm', 'ColumnId') AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'客户编码(金蝶同步锚点之一,与外部数据ID共同幂等)', N'SCHEMA', N'dbo', N'TABLE', N'dm_kh', N'COLUMN', N'dm';
GO
PRINT N'migrate-widen-dm-cols 完成';
GO
