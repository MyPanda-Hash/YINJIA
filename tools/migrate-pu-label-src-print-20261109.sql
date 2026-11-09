-- =============================================================================
-- 材料码打印:记录来源的「采购订单打印记录」
-- 2026-11-09 用户口径:「按这个打印后,要把这个按钮变灰,不能重复打;而且只要记录有金额」
--   · bd_pu_label 增加 [来源打印单号]:材料码是按哪张「有金额」采购订单打印纸带出来的;
--   · 同一张打印记录只能打一次材料码(服务端按此列拒绝重复,界面按它置灰按钮);
--   · 只允许来源为 有金额 版式的采购订单打印记录。
-- 幂等:列已存在则跳过;注释幂等更新。
-- =============================================================================
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF COL_LENGTH(N'dbo.bd_pu_label', N'来源打印单号') IS NULL
BEGIN
    ALTER TABLE dbo.bd_pu_label ADD [来源打印单号] nvarchar(40) NULL;
END
GO

IF COL_LENGTH(N'dbo.bd_pu_label', N'来源打印单号') IS NULL
    THROW 50002, N'bd_pu_label.[来源打印单号] 未建成', 1;
GO

IF EXISTS (SELECT 1 FROM sys.extended_properties ep
           JOIN sys.columns c ON c.object_id = ep.major_id AND c.column_id = ep.minor_id
           WHERE ep.name = N'MS_Description' AND ep.major_id = OBJECT_ID(N'dbo.bd_pu_label') AND c.name = N'来源打印单号')
    EXEC sp_updateextendedproperty N'MS_Description',
        N'来源打印单号:这批材料码是按哪张「采购订单打印记录(有金额)」打出来的;同一张打印记录只允许打一次材料码',
        N'SCHEMA', N'dbo', N'TABLE', N'bd_pu_label', N'COLUMN', N'来源打印单号';
ELSE
    EXEC sp_addextendedproperty N'MS_Description',
        N'来源打印单号:这批材料码是按哪张「采购订单打印记录(有金额)」打出来的;同一张打印记录只允许打一次材料码',
        N'SCHEMA', N'dbo', N'TABLE', N'bd_pu_label', N'COLUMN', N'来源打印单号';
GO
