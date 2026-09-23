-- migrate-wh-field-rename.sql — 仓库字段正名:业务单据的「仓库名称」统一改名「仓库」(+必填)(2026-09-23)
-- ═════════════════════════════════════════════════════════════════════════════════
-- 用户口径(接 migrate-pin-wh-unify 之后):「所有仓库名称的字段统一改名为仓库(必填),销售出库也一样」。
-- 范围 = 业务单据上的选仓库字段;仓库档案本体(WH/CKDA 面板、bs_wh.仓库名称 列)不动:
--   · PURCHASE_IN 明细:仓库名称 → 仓库(列+字段行改名;参照 WH/必填 原样保留);
--   · SALE_OUT:本就有 query,header,detail 的「仓库」参照行(与「仓库名称」并存即用户所见重复)——
--     数据并一列(仓库名称补空←仓库 → 删仓库列 → 仓库名称改名仓库),字段行删仓库名称、
--     既有仓库行设 required=1;
--   · SO_ORDER 明细(隐藏字段):列+字段行同步改名,保持 hidden。
-- 视图配套(源脚本已同批改回 l.仓库,哈希漂移触发链序重跑):v_stock_movement 采购入库段、
--   v_lot_trace 采购入库段;销售出库两视图段本就读 l.仓库,不动。
-- 配套代码(同提交):ButtonService 两处自动生单改写「仓库」;PanelConfigService 撤掉上一轮加的
--   {仓库代码→仓库名称} 对(原 {仓库代码→仓库} 重新覆盖采购入库);StockLedgerService.loadRows
--   采购入库段改回 l.[仓库] AS [行仓库];KingdeePushService 不动(兜底顺序 仓库名称→仓库,
--   前者键缺席自动落仓库)。
-- 幂等:改名/删列/并数据全部判存;字段 UPDATE 天然幂等。
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
GO

-- ═══ 1. bl_sale_out:并数据 → 删旧仓库列 → 仓库名称改名仓库 ═══
-- (守卫+动态SQL:两列并存才并数据,保证改名后的库上重跑幂等——裸 UPDATE 会因 仓库名称 列不存在而编译失败)
IF COL_LENGTH('dbo.bl_sale_out', N'仓库名称') IS NOT NULL AND COL_LENGTH('dbo.bl_sale_out', N'仓库') IS NOT NULL
    EXEC(N'UPDATE bl_sale_out SET [仓库名称] = [仓库]
           WHERE ISNULL([仓库名称], N'''') = N'''' AND ISNULL([仓库], N'''') <> N'''';');
PRINT N'[wh-rename] 销售出库行 仓库名称补空(两列并存时)完成';
GO
-- (守卫:两列并存才是"改名前状态"才删旧列——改名后仓库列与旧列同名,只判存在会误删正名列(实测踩过))
IF COL_LENGTH('dbo.bl_sale_out', N'仓库') IS NOT NULL AND COL_LENGTH('dbo.bl_sale_out', N'仓库名称') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('dbo.bl_sale_out')
               AND minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.bl_sale_out'), N'仓库', 'ColumnId') AND name = 'MS_Description')
        EXEC sys.sp_dropextendedproperty N'MS_Description', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_out', N'COLUMN', N'仓库';
    EXEC(N'ALTER TABLE dbo.bl_sale_out DROP COLUMN [仓库];');
    PRINT N'[wh-rename] bl_sale_out.仓库(旧列,数据已并入)已删';
END
GO
IF COL_LENGTH('dbo.bl_sale_out', N'仓库名称') IS NOT NULL AND COL_LENGTH('dbo.bl_sale_out', N'仓库') IS NULL
BEGIN
    EXEC sp_rename N'dbo.bl_sale_out.仓库名称', N'仓库', 'COLUMN';
    PRINT N'[wh-rename] bl_sale_out.仓库名称 → 仓库';
END
GO

-- ═══ 2. bl_purchase_in / bl_so_order:仓库名称改名仓库(无冲突列,直接改) ═══
IF COL_LENGTH('dbo.bl_purchase_in', N'仓库名称') IS NOT NULL AND COL_LENGTH('dbo.bl_purchase_in', N'仓库') IS NULL
BEGIN
    EXEC sp_rename N'dbo.bl_purchase_in.仓库名称', N'仓库', 'COLUMN';
    PRINT N'[wh-rename] bl_purchase_in.仓库名称 → 仓库';
END
IF COL_LENGTH('dbo.bl_so_order', N'仓库名称') IS NOT NULL AND COL_LENGTH('dbo.bl_so_order', N'仓库') IS NULL
BEGIN
    EXEC sp_rename N'dbo.bl_so_order.仓库名称', N'仓库', 'COLUMN';
    PRINT N'[wh-rename] bl_so_order.仓库名称 → 仓库';
END
GO

-- ═══ 3. yj_field:PURCHASE_IN/SO_ORDER 行改名;SALE_OUT 删多余行 + 必填 ═══
UPDATE yj_field SET col_name = N'仓库', label = N'仓库'
 WHERE panel_code IN ('PURCHASE_IN', 'SO_ORDER') AND col_name = N'仓库名称';
-- SO_ORDER 的仓库列原本就是隐藏的(明细未启用选仓库),显式保持,避免销售订单明细突然多出必填列
UPDATE yj_field SET hidden = 1, visible = 0 WHERE panel_code = 'SO_ORDER' AND col_name = N'仓库';
PRINT N'[wh-rename] PURCHASE_IN/SO_ORDER 字段行改名: ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行(SO_ORDER 保持隐藏)';
DELETE FROM yj_field WHERE panel_code = 'SALE_OUT' AND col_name = N'仓库名称';
PRINT N'[wh-rename] SALE_OUT 冗余 仓库名称 字段行删除: ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
UPDATE yj_field SET required = 1, editable = 1
 WHERE panel_code IN ('PURCHASE_IN', 'SALE_OUT') AND col_name = N'仓库';
PRINT N'[wh-rename] 采购入库/销售出库 仓库字段设必填: ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
GO

-- ═══ 4. 自检 ═══
DECLARE @e int =
    (SELECT COUNT(*) FROM (VALUES (N'bl_sale_out'), (N'bl_purchase_in'), (N'bl_so_order')) t(tbl)
      WHERE COL_LENGTH('dbo.' + tbl, N'仓库名称') IS NOT NULL);
DECLARE @m int =
    (SELECT COUNT(*) FROM (VALUES (N'bl_sale_out'), (N'bl_purchase_in'), (N'bl_so_order')) t(tbl)
      WHERE COL_LENGTH('dbo.' + tbl, N'仓库') IS NULL);
DECLARE @f int = (SELECT COUNT(*) FROM yj_field
                   WHERE panel_code IN ('PURCHASE_IN','SALE_OUT','SO_ORDER') AND col_name = N'仓库名称');
DECLARE @r int = (SELECT COUNT(*) FROM yj_field
                   WHERE panel_code IN ('PURCHASE_IN','SALE_OUT') AND col_name = N'仓库' AND required = 1);
DECLARE @ref int = (SELECT COUNT(*) FROM yj_field
                     WHERE panel_code IN ('PURCHASE_IN','SALE_OUT') AND col_name = N'仓库' AND data_type = N'参照' AND ref_panel = 'WH');
IF @e <> 0 OR @m <> 0 OR @f <> 0 OR @r <> 2 OR @ref <> 2
    RAISERROR(N'[wh-rename] 自检失败:残留仓库名称列 %d(应0)/缺仓库列 %d(应0)/字段残留 %d(应0)/必填 %d(应2)/参照 %d(应2)', 16, 1, @e, @m, @f, @r, @ref);
ELSE
    PRINT N'[wh-rename] 自检通过:三表列名统一为仓库,字段无仓库名称残留,采购入库/销售出库 仓库=参照(WH)+必填';
GO
