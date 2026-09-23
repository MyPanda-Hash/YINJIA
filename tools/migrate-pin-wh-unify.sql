-- migrate-pin-wh-unify.sql — 采购入库单仓库字段收敛:删旧列 [仓库],统一 仓库名称+仓库编码(2026-09-23)
-- ═════════════════════════════════════════════════════════════════════════════════
-- 用户口径:「采购入库单明细又有仓库又有仓库名称——查清哪个真实上传金蝶,另一个删掉」。
-- 查证结论(真实上传链路):
--   · 金蝶收到的仓库 = **仓库编码**(KingdeePushService:行级 仓库编码 > 头级 仓库编码 > 默认 CK00001);
--   · 仓库编码为空时按 仓库名称 → 仓库 的顺序解析 bs_wh 补码——两者都只是兜底源,不是直推值;
--   · 界面参照选仓库绑定的是 **仓库名称**(refMap 同时写 仓库名称+仓库编码);
--   · 旧列 [仓库] 是链路自动带值的历史落点(209/267 行),界面隐藏,仅作最后兜底。
-- 处置:**保留 仓库名称+仓库编码,删除 [仓库]**(头/行两表),链路与视图全部改读 仓库名称:
--   ① 存量回填:仓库名称为空的行用 [仓库] 补(不覆盖已有值);
--   ② 依赖先行(链上顺序保证):migrate-inv-report-fields(v_stock_movement 的 采购入库段
--      l.仓库→l.仓库名称)与 migrate-qc-recv-drop(v_lot_trace 采购入库段)已在各自脚本内改并重跑;
--   ③ DROP COLUMN bd/bl_purchase_in.仓库(含列注明清理);
--   ④ yj_field 删 PURCHASE_IN 的 [仓库] 行(query,header,detail 注册一并消失);
--   ⑤ 配套代码(同提交):ButtonService 两处自动生单(检验→入库/特采→入库)改写 仓库名称;
--      PanelConfigService 链路同义词补 {仓库代码→仓库名称}(多目标并存,退料单等仍吃 {仓库代码→仓库});
--      StockLedgerService.loadRows 采购入库段去掉 行仓库/头仓库 引用;
--      KingdeePushService 不动(兜底读 form-map 键,列删后键缺席=跳过,销售出库不受影响)。
-- ⚠ 必须经 DbSync 按链序执行(本脚本在两个视图脚本之后),手工单独先跑本脚本会让视图悬空。
-- 幂等:回填只补空;DROP 判存在;yj_field DELETE 天然幂等。
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
GO

-- ═══ 1. 存量回填:仓库名称 ← 仓库(仅补空) ═══
UPDATE bl_purchase_in SET [仓库名称] = [仓库]
 WHERE ISNULL([仓库名称], N'') = N'' AND ISNULL([仓库], N'') <> N'';
PRINT N'[pin-wh-unify] 行表回填: ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行(仓库名称 ← 仓库,只补空)';
GO

-- ═══ 2. 删列(含 MS_Description 注明;动态 SQL 判存在) ═══
DECLARE @drop TABLE(tbl sysname, col sysname);
INSERT INTO @drop VALUES (N'bl_purchase_in', N'仓库'), (N'bd_purchase_in', N'仓库');
DECLARE @t sysname, @c sysname;
DECLARE dc CURSOR LOCAL FAST_FORWARD FOR SELECT tbl, col FROM @drop;
OPEN dc; FETCH NEXT FROM dc INTO @t, @c;
WHILE @@FETCH_STATUS = 0 BEGIN
    IF COL_LENGTH('dbo.' + @t, @c) IS NOT NULL
    BEGIN
        IF EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('dbo.' + @t)
                   AND minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.' + @t), @c, 'ColumnId') AND name = 'MS_Description')
            EXEC sys.sp_dropextendedproperty N'MS_Description', N'SCHEMA', N'dbo', N'TABLE', @t, N'COLUMN', @c;
        EXEC(N'ALTER TABLE dbo.' + @t + N' DROP COLUMN ' + @c + N';');
        PRINT N'[pin-wh-unify] 已删列: ' + @t + N'.' + @c;
    END
    ELSE
        PRINT N'[pin-wh-unify] 列不存在(幂等跳过): ' + @t + N'.' + @c;
    FETCH NEXT FROM dc INTO @t, @c;
END
CLOSE dc; DEALLOCATE dc;
GO

-- ═══ 3. yj_field:删 PURCHASE_IN 的 [仓库] 注册 ═══
DELETE FROM yj_field WHERE panel_code = 'PURCHASE_IN' AND col_name = N'仓库';
PRINT N'[pin-wh-unify] yj_field 删除 PURCHASE_IN.仓库 注册: ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
GO

-- ═══ 4. 自检 ═══
DECLARE @c1 int = CASE WHEN COL_LENGTH('dbo.bl_purchase_in', N'仓库') IS NULL THEN 0 ELSE 1 END;
DECLARE @c2 int = CASE WHEN COL_LENGTH('dbo.bd_purchase_in', N'仓库') IS NULL THEN 0 ELSE 1 END;
DECLARE @f  int = (SELECT COUNT(*) FROM yj_field WHERE panel_code = 'PURCHASE_IN' AND col_name = N'仓库');
DECLARE @keep int = (SELECT COUNT(*) FROM yj_field WHERE panel_code = 'PURCHASE_IN'
                      AND col_name = N'仓库名称' AND data_type = N'参照' AND ref_panel = 'WH' AND ISNULL(hidden,0) = 0);
DECLARE @bl int = (SELECT COUNT(*) FROM bl_purchase_in WHERE ISNULL([仓库名称],N'') = N'' AND ISNULL([仓库编码],N'') = N'');
IF @c1 <> 0 OR @c2 <> 0 OR @f <> 0 OR @keep <> 1
    RAISERROR(N'[pin-wh-unify] 自检失败:行表旧列 %d/头表旧列 %d(应 0/0);字段残留 %d(应 0);仓库名称参照注册 %d(应 1)', 16, 1, @c1, @c2, @f, @keep);
ELSE
    PRINT N'[pin-wh-unify] 自检通过:旧列已删、字段注册已清、仓库名称(参照/WH/可见)就位;两列全空的行 ' + CAST(@bl AS nvarchar(10)) + N'(本就没填仓库,不计)';
GO
