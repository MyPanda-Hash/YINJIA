-- =====================================================================================
-- migrate-erp-stock-sync-20261110.sql — 库存数量以金蝶真实账套为准:快照表 + 同步日志表 + 库存状况三列
--
-- 用户口径(2026-11-10):
--   「同步脚本能不能实时同步金蝶真实账套的库存数量,我们想要以金蝶的库存数量为准」
--   → 选 B:直接覆盖 kucun.yl(金蝶即唯一库存),每 5 分钟一轮;同步器 = deploy/sync-stock.mjs。
--
-- 背景(为什么必须这么做,取证见 tools/archive/_dump-out/erp-stock-ims-probe-20261110.md):
--   · 金蝶真实账套 2026-11-10 现存量 1,396 行 / 合计 4,314,349.61;
--   · MES 侧 kucun 2,152 行 / 合计 5,846,961.41 —— 交集 1,263 键里只有 742 键一致,
--     仅金蝶有 133 键、仅 MES 有 889 键;
--   · 根因:2026-10-20「把服务器库导进本地」整库覆盖后真实期初丢失(见
--     docs/development/库存状况异常-当前取证与提交影响-20261021.md),此后 MES 结存只能靠
--     单据流水推,与金蝶渐行渐远。
--
-- 本源文件做的事(幂等,可重复执行):
--   A. kucun 加 3 列:金蝶数量 / 差异数量 / 金蝶同步时间(库存状况面板直接展示,替代"看不见差异");
--   B. erp_stock_snapshot:最近一轮金蝶现存量的逐键快照(含「覆盖前 MES 数量」,留痕可回滚);
--   C. erp_stock_sync_log:每轮同步一行(账套/行数/覆盖/新增/清零/一致/差异合计/耗时/状态);
--   D. yj_field:库存状况面板(STOCK_STATUS)新增上述 3 个列字段(place=detail,只读);
--   E. yj_translation:3 个新字段标签的 en/ja/ko/zh-TW 译名(AGENTS.md 多语言强制规范);
--   F. 自检:列/表/字段/译名齐备,否则 RAISERROR。
--
-- 执行:tools\DbSync(两账套 HSDZ_MES → HSDZ_MES_TEST 各跑一次)
-- 回退:DELETE FROM yj_field WHERE panel_code='STOCK_STATUS' AND col_name IN (N'金蝶数量',N'差异数量',N'金蝶同步时间');
--       DELETE FROM yj_translation WHERE scope='field' AND ref_key IN (N'金蝶数量',N'差异数量',N'金蝶同步时间');
--       DROP TABLE erp_stock_snapshot, erp_stock_sync_log;
--       ALTER TABLE kucun DROP COLUMN 金蝶数量, 差异数量, 金蝶同步时间;
-- =====================================================================================
SET NOCOUNT ON;
GO

/* ══════════════════════ A. kucun 三列(金蝶数量为准的落点) ══════════════════════ */
-- 为什么加在 kucun 而不是另建视图:库存状况面板(STOCK_STATUS,line_table=kucun)是平表直读且可编辑
-- (新增库存/改预警数量),换视图会打断保存链路;三列都只由同步器写、面板只读。
IF COL_LENGTH(N'dbo.kucun', N'金蝶数量') IS NULL
    ALTER TABLE dbo.kucun ADD [金蝶数量] decimal(18,4) NULL;
GO
-- 差异数量 = 计算列(**实时** = 金蝶数量 − 当前现存量 yl),不落冗余值:
--   · 同步刚写完时恒为 0;MES 本地审核单据后立刻反映"这行自上次同步以来记了多少账",
--     ⇒ 天然替代"两天后才发现的账实不符";
--   · 早先建过普通列(本脚本首轮于 2026-11-10 试跑时创建)⇒ 先删再加,幂等。
IF COL_LENGTH(N'dbo.kucun', N'差异数量') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.columns
                    WHERE object_id = OBJECT_ID(N'dbo.kucun') AND name = N'差异数量' AND is_computed = 1)
BEGIN
    ALTER TABLE dbo.kucun DROP COLUMN [差异数量];
    PRINT N'  A. 差异数量 由普通列改为计算列';
END
GO
IF COL_LENGTH(N'dbo.kucun', N'差异数量') IS NULL
    ALTER TABLE dbo.kucun ADD [差异数量] AS
        (CAST([金蝶数量] AS decimal(18,4)) - CAST(ISNULL([yl], 0) AS decimal(18,4)));
GO
IF COL_LENGTH(N'dbo.kucun', N'金蝶同步时间') IS NULL
    ALTER TABLE dbo.kucun ADD [金蝶同步时间] datetime2 NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
               WHERE major_id = OBJECT_ID(N'dbo.kucun')
                 AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.kucun'), N'金蝶数量', 'ColumnId')
                 AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description',
        N'最近一轮金蝶现存量(真实账套 inv_inventory_ims)的该三键数量;由 deploy/sync-stock.mjs 每 5 分钟写入,面板只读',
        N'SCHEMA', N'dbo', N'TABLE', N'kucun', N'COLUMN', N'金蝶数量';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
               WHERE major_id = OBJECT_ID(N'dbo.kucun')
                 AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.kucun'), N'差异数量', 'ColumnId')
                 AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description',
        N'计算列=金蝶数量 − 当前现存量(yl),实时反映"自上次同步以来 MES 本地记账与金蝶的偏差":0=已对齐,≠0=有未同步的本地出入库或账实不符(逐键证据见 erp_stock_snapshot.差异数量)',
        N'SCHEMA', N'dbo', N'TABLE', N'kucun', N'COLUMN', N'差异数量';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
               WHERE major_id = OBJECT_ID(N'dbo.kucun')
                 AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.kucun'), N'金蝶同步时间', 'ColumnId')
                 AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description',
        N'该行最后一次被金蝶现存量覆盖的时间(即最近一轮同步时间);NULL=从未进入过金蝶现存量键集',
        N'SCHEMA', N'dbo', N'TABLE', N'kucun', N'COLUMN', N'金蝶同步时间';
GO

/* ══════════════════════ B. 金蝶库存快照(最近一轮,逐键留痕) ══════════════════════ */
IF OBJECT_ID(N'dbo.erp_stock_snapshot', N'U') IS NULL
CREATE TABLE dbo.erp_stock_snapshot (
    [id] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [批次号] nvarchar(20) NOT NULL,             -- 同步批次 = yyyyMMddHHmmss,与 erp_stock_sync_log.批次号 对应
    [同步时间] datetime2 NOT NULL,
    [物料编码] nvarchar(60) NOT NULL,            -- 金蝶 material_number(kucun.wzdm 同口径)
    [物料名称] nvarchar(200) NULL,
    [仓库编码] nvarchar(400) NOT NULL,           -- 金蝶 stock_number(kucun.ckdm 同口径;宽 400 对齐 kucun.ckdm)
    [仓库名称] nvarchar(200) NULL,
    [批号] nvarchar(60) NULL,                   -- 金蝶 batch_no;真实账套当前全空(无批次商品),空值统一存 NULL
    [单位] nvarchar(40) NULL,                   -- 金蝶辅助单位名(aux_unit_name;unit_name 实测为空)
    [金蝶数量] decimal(18,4) NOT NULL,           -- 金蝶该键现存量
    [MES原数量] decimal(18,4) NULL,              -- 覆盖前 kucun.yl(新增行=NULL)
    [差异数量] decimal(18,4) NULL,               -- 金蝶数量 − MES原数量
    [处理方式] nvarchar(20) NOT NULL,            -- 覆盖 / 新增 / 清零 / 一致
    asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL,
    asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel nvarchar(1) NULL
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_erp_stock_snapshot_key' AND object_id = OBJECT_ID(N'dbo.erp_stock_snapshot'))
    CREATE INDEX ix_erp_stock_snapshot_key ON dbo.erp_stock_snapshot([物料编码], [仓库编码], [批号]);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_erp_stock_snapshot_batch' AND object_id = OBJECT_ID(N'dbo.erp_stock_snapshot'))
    CREATE INDEX ix_erp_stock_snapshot_batch ON dbo.erp_stock_snapshot([批次号]);
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.erp_stock_snapshot') AND minor_id = 0 AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description',
        N'金蝶库存快照(最近一轮):一行=一个(物料编码,仓库编码,批号)键的金蝶现存量与覆盖前MES数量;每轮整表替换,历史轮次看 erp_stock_sync_log。表结构见 migrate-erp-stock-sync-20261110.sql',
        N'SCHEMA', N'dbo', N'TABLE', N'erp_stock_snapshot';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
               WHERE major_id = OBJECT_ID(N'dbo.erp_stock_snapshot')
                 AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.erp_stock_snapshot'), N'处理方式', 'ColumnId')
                 AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description',
        N'覆盖=键已存在且数量变化;一致=键已存在且数量相同;新增=MES 无该键(同步器补行);清零=仅 MES 有该键(金蝶侧无余额,现存量置 0 留痕)',
        N'SCHEMA', N'dbo', N'TABLE', N'erp_stock_snapshot', N'COLUMN', N'处理方式';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
               WHERE major_id = OBJECT_ID(N'dbo.erp_stock_snapshot')
                 AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.erp_stock_snapshot'), N'差异数量', 'ColumnId')
                 AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description',
        N'= 金蝶数量 − MES原数量;正数=金蝶比 MES 多,负数=金蝶比 MES 少。这是判断"两套账差多少"的唯一逐键证据',
        N'SCHEMA', N'dbo', N'TABLE', N'erp_stock_snapshot', N'COLUMN', N'差异数量';
GO

/* ══════════════════════ C. 同步日志(每轮一行,含账套指纹) ══════════════════════ */
IF OBJECT_ID(N'dbo.erp_stock_sync_log', N'U') IS NULL
CREATE TABLE dbo.erp_stock_sync_log (
    [id] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [批次号] nvarchar(20) NOT NULL,
    [账套] nvarchar(80) NULL,                    -- clientId / outerInstanceId(审计:到底同步的是哪个金蝶账套)
    [开始时间] datetime2 NOT NULL,
    [结束时间] datetime2 NULL,
    [耗时毫秒] int NULL,
    [金蝶行数] int NOT NULL CONSTRAINT df_erp_stock_sync_log_kdrows DEFAULT (0),
    [覆盖行数] int NOT NULL CONSTRAINT df_erp_stock_sync_log_updrows DEFAULT (0),
    [新增行数] int NOT NULL CONSTRAINT df_erp_stock_sync_log_insrows DEFAULT (0),
    [清零行数] int NOT NULL CONSTRAINT df_erp_stock_sync_log_zerorows DEFAULT (0),
    [一致行数] int NOT NULL CONSTRAINT df_erp_stock_sync_log_samerows DEFAULT (0),
    [差异合计] decimal(18,4) NULL,               -- Σ(金蝶数量 − MES原数量),正=金蝶多
    [状态] nvarchar(20) NOT NULL CONSTRAINT df_erp_stock_sync_log_state DEFAULT (N'成功'),
    [错误信息] nvarchar(1000) NULL,
    asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL,
    asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel nvarchar(1) NULL
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_erp_stock_sync_log_batch' AND object_id = OBJECT_ID(N'dbo.erp_stock_sync_log'))
    CREATE INDEX ix_erp_stock_sync_log_batch ON dbo.erp_stock_sync_log([批次号], [开始时间]);
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.erp_stock_sync_log') AND minor_id = 0 AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description',
        N'金蝶库存同步日志(每轮一行):账套指纹/金蝶行数/覆盖·新增·清零·一致行数/差异合计/耗时/状态;由 deploy/sync-stock.mjs 写入,计划任务每 5 分钟一轮',
        N'SCHEMA', N'dbo', N'TABLE', N'erp_stock_sync_log';
GO

/* ══════════════════════ D. 库存状况面板的 3 个字段(只读展示) ══════════════════════ */
IF EXISTS (SELECT 1 FROM dbo.yj_panel WHERE panel_code = 'STOCK_STATUS')
BEGIN
    IF NOT EXISTS (SELECT 1 FROM dbo.yj_field WHERE panel_code = 'STOCK_STATUS' AND col_name = N'金蝶数量')
        INSERT INTO dbo.yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
        VALUES ('STOCK_STATUS', N'金蝶数量', N'金蝶数量', N'小数', 'detail', 11, 100, 0, 0, 0, 1);
    IF NOT EXISTS (SELECT 1 FROM dbo.yj_field WHERE panel_code = 'STOCK_STATUS' AND col_name = N'差异数量')
        INSERT INTO dbo.yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
        VALUES ('STOCK_STATUS', N'差异数量', N'差异数量', N'小数', 'detail', 12, 100, 0, 0, 0, 1);
    IF NOT EXISTS (SELECT 1 FROM dbo.yj_field WHERE panel_code = 'STOCK_STATUS' AND col_name = N'金蝶同步时间')
        INSERT INTO dbo.yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
        VALUES ('STOCK_STATUS', N'金蝶同步时间', N'金蝶同步时间', N'日期', 'detail', 13, 150, 0, 0, 0, 1);
    PRINT N'  D. STOCK_STATUS 三字段已就位';
END
ELSE PRINT N'  D. 跳过:无 STOCK_STATUS 面板';
GO

/* ══════════════════════ E. 多语言词条(AGENTS.md 多语言强制规范) ══════════════════════ */
DECLARE @t TABLE (scope varchar(20), ref_key nvarchar(400), locale varchar(10), text nvarchar(1000));
INSERT INTO @t (scope, ref_key, locale, text) VALUES
 ('field', N'金蝶数量', 'en', N'Kingdee qty'),
 ('field', N'金蝶数量', 'ja', N'金蝶数量'),
 ('field', N'金蝶数量', 'ko', N'Kingdee 수량'),
 ('field', N'金蝶数量', 'zh-TW', N'金蝶數量'),
 ('field', N'差异数量', 'en', N'Variance quantity'),
 ('field', N'差异数量', 'ja', N'差異数量'),
 ('field', N'差异数量', 'ko', N'차이 수량'),
 ('field', N'差异数量', 'zh-TW', N'差異數量'),
 ('field', N'金蝶同步时间', 'en', N'Kingdee sync time'),
 ('field', N'金蝶同步时间', 'ja', N'金蝶同期日時'),
 ('field', N'金蝶同步时间', 'ko', N'Kingdee 동기화 시간'),
 ('field', N'金蝶同步时间', 'zh-TW', N'金蝶同步時間');

INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT t.scope, t.ref_key, t.locale, t.text, 'manual'
  FROM @t t
 WHERE NOT EXISTS (SELECT 1 FROM yj_translation x
                    WHERE x.scope = t.scope AND x.ref_key = t.ref_key AND x.locale = t.locale);
PRINT N'  E. 多语言词条已就位';
GO

/* ══════════════════════ F. 自检 ══════════════════════ */
DECLARE @hasQty int = CASE WHEN COL_LENGTH(N'dbo.kucun', N'金蝶数量') IS NULL THEN 1 ELSE 0 END
      + CASE WHEN COL_LENGTH(N'dbo.kucun', N'差异数量') IS NULL THEN 1 ELSE 0 END
      + CASE WHEN COL_LENGTH(N'dbo.kucun', N'金蝶同步时间') IS NULL THEN 1 ELSE 0 END;
DECLARE @snapOk int = CASE WHEN OBJECT_ID(N'dbo.erp_stock_snapshot', N'U') IS NULL THEN 1 ELSE 0 END
      + CASE WHEN OBJECT_ID(N'dbo.erp_stock_sync_log', N'U') IS NULL THEN 1 ELSE 0 END;
DECLARE @fieldN int = (SELECT COUNT(*) FROM dbo.yj_field WHERE panel_code = 'STOCK_STATUS'
                        AND col_name IN (N'金蝶数量', N'差异数量', N'金蝶同步时间'));
DECLARE @transN int = (SELECT COUNT(*) FROM dbo.yj_translation WHERE scope = 'field'
                        AND ref_key IN (N'金蝶数量', N'差异数量', N'金蝶同步时间'));
SELECT @hasQty AS 缺列数, @snapOk AS 缺表数, @fieldN AS 字段数, @transN AS 译名数;
IF @hasQty <> 0 OR @snapOk <> 0 OR @fieldN <> 3 OR @transN < 12
    RAISERROR(N'金蝶库存同步结构不完整(期望 3 列 / 2 表 / 3 字段 / ≥12 译名)', 16, 1);
PRINT N'== migrate-erp-stock-sync-20261110 完成 ==';
GO
