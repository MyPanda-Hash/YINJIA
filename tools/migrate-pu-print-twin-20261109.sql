-- =============================================================================
-- 采购订单打印记录:增加「对应单号」(有金额 ↔ 无金额 相互对着打印)
-- 2026-11-09 用户口径:「有各自份额,但是要互相记录对方的对应信息,可以相互对着打印」
--   · 两个版式各有各的剩余可打(已按版式隔离);
--   · 每次打印时,把**另一版式最近一张存活记录**的号写进本记录的 [对应单号],
--     并反向写回对方 —— 两张纸互为对照,可据任一张「对着」打另一版式。
-- 幂等:列已存在则跳过;注释按扩展属性写法幂等更新。
-- =============================================================================
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF COL_LENGTH(N'dbo.bd_pu_print', N'对应单号') IS NULL
BEGIN
    ALTER TABLE dbo.bd_pu_print ADD [对应单号] nvarchar(40) NULL;
END
GO

IF COL_LENGTH(N'dbo.bd_pu_print', N'对应单号') IS NULL
    THROW 50001, N'bd_pu_print.[对应单号] 未建成', 1;
GO

-- 中文注释(幂等)
IF EXISTS (SELECT 1 FROM sys.extended_properties ep
           JOIN sys.columns c ON c.object_id = ep.major_id AND c.column_id = ep.minor_id
           WHERE ep.name = N'MS_Description' AND ep.major_id = OBJECT_ID(N'dbo.bd_pu_print') AND c.name = N'对应单号')
    EXEC sp_updateextendedproperty N'MS_Description',
        N'对应单号:另一打印版式(有金额/无金额)最近一张存活打印记录的 单据编号;两张纸互为对照,可相互对着打印',
        N'SCHEMA', N'dbo', N'TABLE', N'bd_pu_print', N'COLUMN', N'对应单号';
ELSE
    EXEC sp_addextendedproperty N'MS_Description',
        N'对应单号:另一打印版式(有金额/无金额)最近一张存活打印记录的 单据编号;两张纸互为对照,可相互对着打印',
        N'SCHEMA', N'dbo', N'TABLE', N'bd_pu_print', N'COLUMN', N'对应单号';
GO
