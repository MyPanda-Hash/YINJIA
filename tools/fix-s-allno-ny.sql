-- fix-s-allno-ny.sql — 修复单号池 s_allno.ny 列宽不足导致所有单据面板保存报"将截断字符串或二进制数据"
-- 根因:legacy-hsdz-compat.sql 建表时 ny varchar(6)(旧紧凑格式 yyMMdd);
--      2026-09-07 起单号规则改为「前缀-yyyy-MM-NNNN」(migrate-formno-style.sql / FormNoService),
--      ny 写入 "yyyy-MM"=7 字符 > 6,每次新增保存 INSERT s_allno 必然截断失败。
-- 修法:ny 加宽到 varchar(10)(容纳 yyyy-MM 与历史 yyMMdd 两种形态);索引含 ny 需先删后建。
-- 幂等:仅在列宽不足时执行;索引重建 NOT EXISTS 守卫,可重复执行。
SET NOCOUNT ON;
GO
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.s_allno') AND name = 'ny' AND max_length < 7)
BEGIN
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_s_allno_lb_ny' AND object_id = OBJECT_ID('dbo.s_allno'))
        DROP INDEX ix_s_allno_lb_ny ON dbo.s_allno;
    ALTER TABLE dbo.s_allno ALTER COLUMN ny varchar(10) NOT NULL;
    PRINT N's_allno.ny 已加宽 varchar(6)→varchar(10)';
END
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_s_allno_lb_ny' AND object_id = OBJECT_ID('dbo.s_allno'))
    CREATE INDEX ix_s_allno_lb_ny ON dbo.s_allno (lb, ny, dh);
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('dbo.s_allno') AND minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.s_allno'), 'ny', 'ColumnId') AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'年月段:新横杠格式单号存 yyyy-MM(7位),旧紧凑格式历史行存 yyMMdd(6位)', N'SCHEMA', N'dbo', N'TABLE', N's_allno', N'COLUMN', N'ny';
GO
-- 自检:列宽 + 与 FormNoService 同形的 INSERT/DELETE 实测
SELECT c.name AS col, t.name AS typ, c.max_length FROM sys.columns c JOIN sys.types t ON c.user_type_id = t.user_type_id
WHERE c.object_id = OBJECT_ID('dbo.s_allno') AND c.name IN ('ny', 'dh');
BEGIN TRY
    INSERT INTO s_allno (comm, dh, lb, ny, asp_user1, asp_time1, asp_cancel)
    VALUES ('0', 'ZZ-2026-09-9999', 'ZZ', '2026-09', 'fix-probe', GETDATE(), 'N');
    PRINT N'实测 INSERT ny=2026-09 成功(列宽已够)';
    DELETE FROM s_allno WHERE lb = 'ZZ' AND asp_user1 = 'fix-probe';
    PRINT N'探针行已清理';
END TRY
BEGIN CATCH
    PRINT N'实测 INSERT 仍失败: ' + ERROR_MESSAGE();
END CATCH
GO
PRINT N'fix-s-allno-ny 完成';
GO
