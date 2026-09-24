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
-- (2026-09-24 重放守卫:两列并存才回填,改动态 SQL —— 列已改名/已删的库上裸 UPDATE 编译不过,实测踩过)
IF COL_LENGTH('dbo.bl_purchase_in', N'仓库名称') IS NOT NULL AND COL_LENGTH('dbo.bl_purchase_in', N'仓库') IS NOT NULL
    EXEC(N'UPDATE bl_purchase_in SET [仓库名称] = [仓库]
           WHERE ISNULL([仓库名称], N'''') = N'''' AND ISNULL([仓库], N'''') <> N'''';');
PRINT N'[pin-wh-unify] 行表回填(两列并存时)完成';
GO

-- ═══ 2. 删列(含 MS_Description 注明;动态 SQL 判存在) ═══
-- (2026-09-24 重放守卫:**两列并存**(=改名前的原始双列态)才删 [仓库]——改名终态的库上
-- [仓库] 是正名列(由 仓库名称 改名而来),只判存在会把它误删(实测事故,靠快照复原)。
DECLARE @drop TABLE(tbl sysname, col sysname, sib sysname);
INSERT INTO @drop VALUES (N'bl_purchase_in', N'仓库', N'仓库名称'), (N'bd_purchase_in', N'仓库', N'仓库名称');
DECLARE @t sysname, @c sysname, @s sysname;
DECLARE dc CURSOR LOCAL FAST_FORWARD FOR SELECT tbl, col, sib FROM @drop;
OPEN dc; FETCH NEXT FROM dc INTO @t, @c, @s;
WHILE @@FETCH_STATUS = 0 BEGIN
    IF COL_LENGTH('dbo.' + @t, @c) IS NOT NULL AND COL_LENGTH('dbo.' + @t, @s) IS NOT NULL
    BEGIN
        IF EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('dbo.' + @t)
                   AND minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.' + @t), @c, 'ColumnId') AND name = 'MS_Description')
            EXEC sys.sp_dropextendedproperty N'MS_Description', N'SCHEMA', N'dbo', N'TABLE', @t, N'COLUMN', @c;
        EXEC(N'ALTER TABLE dbo.' + @t + N' DROP COLUMN ' + @c + N';');
        PRINT N'[pin-wh-unify] 已删列(双列并存态): ' + @t + N'.' + @c;
    END
    ELSE
        PRINT N'[pin-wh-unify] 非双列并存态(幂等跳过,保护正名仓库列): ' + @t + N'.' + @c;
    FETCH NEXT FROM dc INTO @t, @c, @s;
END
CLOSE dc; DEALLOCATE dc;
GO

-- ═══ 3. yj_field:删 PURCHASE_IN 的**旧头级/查询级** [仓库] 注册 ═══
-- (2026-09-24 终态语义:正名后明细位也有合法的 [仓库] 行(由 仓库名称 改名而来),只清 header/query 位)
DELETE FROM yj_field WHERE panel_code = 'PURCHASE_IN' AND col_name = N'仓库'
 AND (place LIKE '%header%' OR place LIKE '%query%');
PRINT N'[pin-wh-unify] yj_field 删除 PURCHASE_IN 头级/查询级 仓库 注册: ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
GO

-- ═══ 4. 自检(终态口径) ═══
DECLARE @f  int = (SELECT COUNT(*) FROM yj_field WHERE panel_code = 'PURCHASE_IN' AND col_name = N'仓库'
                    AND (place LIKE '%header%' OR place LIKE '%query%'));
DECLARE @keep int = (SELECT COUNT(*) FROM yj_field WHERE panel_code = 'PURCHASE_IN'
                      AND col_name = N'仓库' AND place = 'detail' AND data_type = N'参照' AND ref_panel = 'WH');
-- (改名前 era:keep 也兼容 仓库名称 行——两个名字任一在明细位注册为 WH 参照即算就位)
DECLARE @keep2 int = (SELECT COUNT(*) FROM yj_field WHERE panel_code = 'PURCHASE_IN'
                       AND col_name = N'仓库名称' AND place = 'detail' AND data_type = N'参照' AND ref_panel = 'WH');
-- (2026-09-24 重放守卫:行数统计判列存在再动态执行——改名终态库上 [仓库名称] 已删,裸引用编译不过)
DECLARE @bl int = 0;
IF COL_LENGTH('dbo.bl_purchase_in', N'仓库名称') IS NOT NULL
    EXEC sp_executesql N'SELECT @bl = COUNT(*) FROM bl_purchase_in WHERE ISNULL([仓库名称],N'''') = N'''' AND ISNULL([仓库编码],N'''') = N'''';',
         N'@bl int OUTPUT', @bl OUTPUT;
DECLARE @sum int = @keep + @keep2;  -- RAISERROR 参数只收变量,不能内联表达式
IF @f <> 0 OR @sum <> 1
    RAISERROR(N'[pin-wh-unify] 自检失败:头级/查询级残留 %d(应 0);明细仓库(参照 WH)注册 %d(应 1)', 16, 1, @f, @sum);
ELSE
    PRINT N'[pin-wh-unify] 自检通过:头级/查询级已清、明细仓库(参照 WH)就位;两列全空的行 ' + CAST(@bl AS nvarchar(10)) + N'(本就没填仓库,不计)';
GO
