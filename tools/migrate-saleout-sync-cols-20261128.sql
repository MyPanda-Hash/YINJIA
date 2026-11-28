/* ============================================================
   migrate-saleout-sync-cols-20261128.sql — 2026-11-28
   销售出库单接入「金蝶同步」:补同步锚点两列 + 唯一过滤索引 + 中文注明

   ── 背景(2026-11-28 用户口径)──
   「现在需要同步下拉销售出库单,并且销售出库要打印报表,需求是分批次号的明细,
     根据同一物料成一行来打印。」
   ⇒ ① 把金蝶「销售出库单」(`/jdy/v2/scm/sal_out_bound`)整单**增量同步进 MES**,
        落在现役面板 `SALE_OUT` 的 `bd_sale_out` / `bl_sale_out`(含明细批号),不另建镜像表;
      ② 销售出库单面板「打印」下拉新增「出货单」:同一物料合成一行,批号进备注列。
   数据缺口基线见 docs/development/MES与金蝶出入库对照.md:金蝶已审核 **5,475** 张 vs MES **455** 张(8.3%),
   2026-10-14 之后 MES 侧几乎空转(11 月 0 张)⇒ 出货单(印刷联单)没有数据可打。

   ── 为什么补这两列 ──
   同步框架 `deploy/sync-core.mjs` 的唯一锚点是头表两列:**外部数据ID**(金蝶 id)+ **外部指纹**
   (列表级指纹,判断「有无变化」)。其余单据头表(`bd_so_order` / `bd_pu_order`)2026-09 就已具备
   这两列 + 唯一过滤索引,而销售出库单头表当年是「MES 自己开单、推金蝶」,从没有同步锚点。
   不补的后果:`upsertDoc` 的 `INSERT ... 外部数据ID, 外部指纹` 直接报「列名无效」,整类同步 0 行。

   ── 口径提醒 ──
   同步进来的是**金蝶侧真实单据**(含金蝶里手工开的单)。MES 侧判定「谁发起的」看
   `是否已转ERP / 转ERP操作人 / 外部数据ID`:
     · `外部数据ID` 非空 = 经本同步写入/收编(金蝶侧存在);
     · `转ERP操作人` 非空 = 当年由 MES 转ERP 推送过去的。
   同步写入的单一插头是 `mapHead` 里的 `是否已转ERP='是'`(挡住二次推送),不经过审核动作 ⇒ 不动 `kucun`。

   幂等:IF COL_LENGTH 守卫 / 索引存在性守卫 / 扩展属性 add-or-update 双分支;
   两账套都执行(先 HSDZ_MES 正式,后 HSDZ_MES_TEST 测试;DbSync 按内容哈希登记)。
   ============================================================ */
SET NOCOUNT ON;
GO

-- ═══ ① 补同步锚点两列(类型/可空性与 bd_so_order / bd_pu_order 同名同型)═══
IF COL_LENGTH(N'dbo.bd_sale_out', N'外部数据ID') IS NULL
    ALTER TABLE dbo.bd_sale_out ADD [外部数据ID] nvarchar(128) NULL;
GO
IF COL_LENGTH(N'dbo.bd_sale_out', N'外部指纹') IS NULL
    ALTER TABLE dbo.bd_sale_out ADD [外部指纹] nvarchar(1000) NULL;
GO

-- ═══ ② 唯一过滤索引(与 ux_bd_so_order_ext_id / ux_bd_pu_order_ext_id 同形)═══
-- 可空列上的唯一索引在 SQL Server 里只允许一个 NULL ⇒ 必须带过滤条件。
IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE object_id = OBJECT_ID(N'dbo.bd_sale_out') AND name = N'ux_bd_sale_out_ext_id')
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX ux_bd_sale_out_ext_id ON dbo.bd_sale_out ([外部数据ID])
        WHERE [外部数据ID] IS NOT NULL;
    PRINT N'[OK] bd_sale_out 建唯一过滤索引 ux_bd_sale_out_ext_id';
END
ELSE
    PRINT N'[SKIP] ux_bd_sale_out_ext_id 已存在';
GO

-- ═══ ③ 列中文注明(AGENTS §2.2:同脚本内为新列写 MS_Description)═══
IF COL_LENGTH(N'dbo.bd_sale_out', N'外部数据ID') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.major_id = OBJECT_ID(N'dbo.bd_sale_out')
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_out'), N'外部数据ID', 'ColumnId')
                 AND ep.name = N'MS_Description')
        EXEC sp_updateextendedproperty N'MS_Description',
             N'外部数据ID:金蝶 sal_out_bound 的单据 id(2026-11-28 起由 deploy/sync-core.mjs 增量同步写入;唯一过滤索引 ux_bd_sale_out_ext_id)',
             N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_out', N'COLUMN', N'外部数据ID';
    ELSE
        EXEC sp_addextendedproperty N'MS_Description',
             N'外部数据ID:金蝶 sal_out_bound 的单据 id(2026-11-28 起由 deploy/sync-core.mjs 增量同步写入;唯一过滤索引 ux_bd_sale_out_ext_id)',
             N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_out', N'COLUMN', N'外部数据ID';
END
GO
IF COL_LENGTH(N'dbo.bd_sale_out', N'外部指纹') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.major_id = OBJECT_ID(N'dbo.bd_sale_out')
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_out'), N'外部指纹', 'ColumnId')
                 AND ep.name = N'MS_Description')
        EXEC sp_updateextendedproperty N'MS_Description',
             N'外部指纹:金蝶列表级指纹(状态/结算/发货/日期/客户/经手/金额/数量…;一致即跳过详情,明细另有「每日复核日戳」兜底)',
             N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_out', N'COLUMN', N'外部指纹';
    ELSE
        EXEC sp_addextendedproperty N'MS_Description',
             N'外部指纹:金蝶列表级指纹(状态/结算/发货/日期/客户/经手/金额/数量…;一致即跳过详情,明细另有「每日复核日戳」兜底)',
             N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_out', N'COLUMN', N'外部指纹';
END
GO

-- ═══ ④ 自检(severity 10 = 信息级;DbSync 会打印)═══
DECLARE @c1 int = COL_LENGTH(N'dbo.bd_sale_out', N'外部数据ID');
DECLARE @c2 int = COL_LENGTH(N'dbo.bd_sale_out', N'外部指纹');
DECLARE @c3 int = COL_LENGTH(N'dbo.bd_sale_out', N'外部单据号');
DECLARE @ix int = (SELECT COUNT(*) FROM sys.indexes
                   WHERE object_id = OBJECT_ID(N'dbo.bd_sale_out') AND name = N'ux_bd_sale_out_ext_id');
DECLARE @ixf int = (SELECT COUNT(*) FROM sys.indexes
                    WHERE object_id = OBJECT_ID(N'dbo.bd_sale_out') AND name = N'ux_bd_sale_out_ext_id'
                      AND has_filter = 1 AND is_unique = 1);
IF @c1 IS NOT NULL AND @c2 IS NOT NULL AND @c3 IS NOT NULL AND @ix = 1 AND @ixf = 1
    RAISERROR(N'SELFCHECK OK  bd_sale_out:外部数据ID/外部指纹 已补(外部单据号原有)+ 唯一过滤索引就位', 10, 1) WITH NOWAIT;
ELSE
    RAISERROR(N'SELFCHECK FAIL bd_sale_out 外部数据ID=%d 外部指纹=%d 外部单据号=%d 索引=%d 过滤唯一=%d', 16, 1, @c1, @c2, @c3, @ix, @ixf);
GO

PRINT N'migrate-saleout-sync-cols-20261128 完成';
GO
