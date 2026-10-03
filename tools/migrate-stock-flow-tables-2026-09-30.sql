-- migrate-stock-flow-tables-2026-09-30.sql
-- 把遗留表 inh/outh 重建为 MES 库存流水表（入库流水 / 出库流水）—— 幂等,两个账套都要执行
SET NOCOUNT ON;
GO

/* ═══════════════════════════════════════════════════════════════════════
   背景:库存原为 kucun 单表(rkl 累计入 / ckl 累计出 / yl 余量),没有明细 ⇒
   答不出"某天的库存是多少"、结存无法对账、单笔无法更正。
   用户 2026-09-30 拍板改为三表:inh(入库流水) + outh(出库流水) + kucun(结存缓存),
   且**复用遗留表名 inh/outh**(明确要求"利用之前留下来的表")。
   但老 inh/outh 是纺织行业的进货单/出货单:115/126 列、数量单位是"米/公斤"、
   条码是"床号-床次-扎号",与本系统(滤芯制造,按个/支)语义冲突 ⇒ 清空重建列。

   重建后的列与 v_stock_movement 对齐:src(1..4 入 / 5..8 出,沿用原段号) + rid(来源行 id),
   这两列构成**唯一键** ⇒ 同一单据重复审核不会重复记流水(幂等)。
   ═══════════════════════════════════════════════════════════════════════ */

-- ① 备份老数据(唯一可回退抓手;只备份一次)
IF OBJECT_ID('dbo.inh_bak_20260930') IS NULL AND OBJECT_ID('dbo.inh') IS NOT NULL
BEGIN
  SELECT * INTO dbo.inh_bak_20260930 FROM dbo.inh;
  PRINT N'[OK] 已备份 inh → inh_bak_20260930';
END
IF OBJECT_ID('dbo.outh_bak_20260930') IS NULL AND OBJECT_ID('dbo.outh') IS NOT NULL
BEGIN
  SELECT * INTO dbo.outh_bak_20260930 FROM dbo.outh;
  PRINT N'[OK] 已备份 outh → outh_bak_20260930';
END
GO

-- ② 重建 inh(入库流水)。判断口径:重建后的表必须有 src 列;没有即视为旧结构,直接重建。
IF OBJECT_ID('dbo.inh') IS NOT NULL AND COL_LENGTH('dbo.inh', N'src') IS NULL
BEGIN
  DROP TABLE dbo.inh;
  PRINT N'[OK] 旧 inh 已删除(数据在 inh_bak_20260930)';
END
GO
IF OBJECT_ID('dbo.inh') IS NULL
BEGIN
  CREATE TABLE dbo.inh (
    id          bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_inh PRIMARY KEY,
    src         int              NOT NULL,              -- 来源段号:1 采购入库 / 2 产成品入库 / 3 其他入库 / 4 委外入库 / 0 期初结存
    rid         bigint           NULL,                  -- 来源单据行 id(bl_*.id);期初行为 NULL
    单据编号    nvarchar(50)     NULL,
    单据类型    nvarchar(50)     NULL,                  -- 采购入库单 / 产成品入库单 / 其他入库单 / 委外入库单 / 期初结存
    单据日期    datetime         NULL,
    物料编码    nvarchar(50)     NULL,
    物料名称    nvarchar(200)    NULL,
    规格型号    nvarchar(200)    NULL,
    计量单位    nvarchar(20)     NULL,
    仓库编码    nvarchar(50)     NULL,
    仓库名称    nvarchar(100)    NULL,
    批号        nvarchar(60)     NULL,
    数量        decimal(18,4)    NOT NULL CONSTRAINT DF_inh_数量 DEFAULT(0),
    单价        decimal(18,6)    NULL,
    金额        decimal(18,4)    NULL,
    往来单位    nvarchar(200)    NULL,
    经手人      nvarchar(50)     NULL,
    asp_user1   nvarchar(40)     NULL,
    asp_time1   datetime2        NULL,
    asp_user2   nvarchar(40)     NULL,
    asp_time2   datetime2        NULL,
    asp_cancel  nvarchar(2)      NULL,
    asp_user4   nvarchar(40)     NULL,
    asp_time4   datetime2        NULL,
    备用1 nvarchar(500) NULL, 备用2 nvarchar(500) NULL, 备用3 nvarchar(500) NULL, 备用4 nvarchar(500) NULL,
    备用5 nvarchar(500) NULL, 备用6 nvarchar(500) NULL, 备用7 nvarchar(500) NULL, 备用8 nvarchar(500) NULL,
    备用9 nvarchar(500) NULL, 备用10 nvarchar(500) NULL, 备用11 nvarchar(500) NULL, 备用12 nvarchar(500) NULL,
    备用13 nvarchar(500) NULL, 备用14 nvarchar(500) NULL, 备用15 nvarchar(500) NULL, 备用16 nvarchar(500) NULL,
    备用17 nvarchar(500) NULL, 备用18 nvarchar(500) NULL, 备用19 nvarchar(500) NULL, 备用20 nvarchar(500) NULL
  );
  -- (src,rid) 唯一:同一单据行只记一次流水;期初行 rid 为 NULL,SQL Server 唯一索引允许多个 NULL
  CREATE UNIQUE INDEX UX_inh_src_rid ON dbo.inh (src, rid);
  CREATE INDEX IX_inh_三键 ON dbo.inh (物料编码, 仓库编码, 批号);
  CREATE INDEX IX_inh_单据编号 ON dbo.inh (单据编号);
  PRINT N'[OK] inh 已重建为 MES 入库流水表';
END
ELSE PRINT N'[SKIP] inh 已是新结构';
GO

-- ③ 重建 outh(出库流水)。比 inh 多三列成本相关(出库成本来自 inv_cost_ledger)
IF OBJECT_ID('dbo.outh') IS NOT NULL AND COL_LENGTH('dbo.outh', N'src') IS NULL
BEGIN
  DROP TABLE dbo.outh;
  PRINT N'[OK] 旧 outh 已删除(数据在 outh_bak_20260930)';
END
GO
IF OBJECT_ID('dbo.outh') IS NULL
BEGIN
  CREATE TABLE dbo.outh (
    id          bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_outh PRIMARY KEY,
    src         int              NOT NULL,              -- 5 销售出库 / 6 材料出库 / 7 其他出库 / 8 委外发料
    rid         bigint           NULL,
    单据编号    nvarchar(50)     NULL,
    单据类型    nvarchar(50)     NULL,
    单据日期    datetime         NULL,
    物料编码    nvarchar(50)     NULL,
    物料名称    nvarchar(200)    NULL,
    规格型号    nvarchar(200)    NULL,
    计量单位    nvarchar(20)     NULL,
    仓库编码    nvarchar(50)     NULL,
    仓库名称    nvarchar(100)    NULL,
    批号        nvarchar(60)     NULL,
    数量        decimal(18,4)    NOT NULL CONSTRAINT DF_outh_数量 DEFAULT(0),
    单据金额    decimal(18,4)    NULL,                  -- 单据上的售价金额(原 v_stock_movement 的 发出单据金额)
    成本单价    decimal(18,6)    NULL,                  -- 由 inv_cost_ledger 回填(移动加权)
    成本金额    decimal(18,4)    NULL,
    往来单位    nvarchar(200)    NULL,
    经手人      nvarchar(50)     NULL,
    asp_user1   nvarchar(40)     NULL,
    asp_time1   datetime2        NULL,
    asp_user2   nvarchar(40)     NULL,
    asp_time2   datetime2        NULL,
    asp_cancel  nvarchar(2)      NULL,
    asp_user4   nvarchar(40)     NULL,
    asp_time4   datetime2        NULL,
    备用1 nvarchar(500) NULL, 备用2 nvarchar(500) NULL, 备用3 nvarchar(500) NULL, 备用4 nvarchar(500) NULL,
    备用5 nvarchar(500) NULL, 备用6 nvarchar(500) NULL, 备用7 nvarchar(500) NULL, 备用8 nvarchar(500) NULL,
    备用9 nvarchar(500) NULL, 备用10 nvarchar(500) NULL, 备用11 nvarchar(500) NULL, 备用12 nvarchar(500) NULL,
    备用13 nvarchar(500) NULL, 备用14 nvarchar(500) NULL, 备用15 nvarchar(500) NULL, 备用16 nvarchar(500) NULL,
    备用17 nvarchar(500) NULL, 备用18 nvarchar(500) NULL, 备用19 nvarchar(500) NULL, 备用20 nvarchar(500) NULL
  );
  CREATE UNIQUE INDEX UX_outh_src_rid ON dbo.outh (src, rid);
  CREATE INDEX IX_outh_三键 ON dbo.outh (物料编码, 仓库编码, 批号);
  CREATE INDEX IX_outh_单据编号 ON dbo.outh (单据编号);
  PRINT N'[OK] outh 已重建为 MES 出库流水表';
END
ELSE PRINT N'[SKIP] outh 已是新结构';
GO

-- ④ 列级中文注明(逐列,幂等写法)
DECLARE @cols TABLE (tbl sysname, col sysname, note nvarchar(400));
INSERT INTO @cols (tbl, col, note) VALUES
 ('inh','src',      N'来源段号:0 期初结存 / 1 采购入库 / 2 产成品入库 / 3 其他入库 / 4 委外入库(与 v_stock_movement 的 src 同口径)'),
 ('inh','rid',      N'来源单据行 id(bl_*.id);与 src 组成唯一键,保证同一单据行只记一次流水。期初行为 NULL'),
 ('inh','单据编号',  N'来源单据编号'),
 ('inh','单据类型',  N'采购入库单/产成品入库单/其他入库单/委外入库单/期初结存'),
 ('inh','单据日期',  N'来源单据日期(时点还原余量靠它)'),
 ('inh','物料编码',  N'存货编码(对应 bs_inv)'),
 ('inh','仓库编码',  N'仓库编码(对应 bs_wh,写入前必须能解析到档案)'),
 ('inh','批号',      N'批号(台账三键之一:物料编码+仓库编码+批号)'),
 ('inh','数量',      N'入库数量(正数入库,负数=红字冲回)'),
 ('inh','金额',      N'入库金额 = 单据金额 或 单价×数量'),
 ('outh','src',      N'来源段号:5 销售出库 / 6 材料出库 / 7 其他出库 / 8 委外发料(与 v_stock_movement 的 src 同口径)'),
 ('outh','rid',      N'来源单据行 id(bl_*.id);与 src 组成唯一键'),
 ('outh','数量',     N'出库数量(正数出库;弃审时写负数红冲行)'),
 ('outh','单据金额',  N'单据上的售价金额(不参与成本,仅留档,避免信息丢失)'),
 ('outh','成本单价',  N'移动加权出库单价,由 inv_cost_ledger 回填'),
 ('outh','成本金额',  N'出库成本金额 = 成本单价×数量,由 inv_cost_ledger 回填'),
 ('outh','批号',     N'批号(台账三键之一;出库必须带批号)');
DECLARE @t sysname, @c sysname, @n nvarchar(400);
DECLARE cur CURSOR FOR SELECT tbl, col, note FROM @cols;
OPEN cur; FETCH NEXT FROM cur INTO @t, @c, @n;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF COL_LENGTH(@t, @c) IS NOT NULL
  BEGIN
    IF EXISTS (SELECT 1 FROM sys.extended_properties ep
                WHERE ep.major_id = OBJECT_ID(@t) AND ep.class = 1
                  AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(@t), @c, 'ColumnId') AND ep.name = N'MS_Description')
      EXEC sp_updateextendedproperty N'MS_Description', @n, N'SCHEMA', N'dbo', N'TABLE', @t, N'COLUMN', @c;
    ELSE
      EXEC sp_addextendedproperty N'MS_Description', @n, N'SCHEMA', N'dbo', N'TABLE', @t, N'COLUMN', @c;
  END
  FETCH NEXT FROM cur INTO @t, @c, @n;
END
CLOSE cur; DEALLOCATE cur;
PRINT N'[OK] inh/outh 列级中文注明已写入';
GO

-- ⑤ 自检
DECLARE @ok int = 0;
IF COL_LENGTH('dbo.inh', N'src') IS NOT NULL SET @ok = @ok + 1;
IF COL_LENGTH('dbo.inh', N'rid') IS NOT NULL SET @ok = @ok + 1;
IF COL_LENGTH('dbo.outh', N'src') IS NOT NULL SET @ok = @ok + 1;
IF COL_LENGTH('dbo.outh', N'成本金额') IS NOT NULL SET @ok = @ok + 1;
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_inh_src_rid') SET @ok = @ok + 1;
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_outh_src_rid') SET @ok = @ok + 1;
IF @ok = 6
  PRINT N'[OK] 自检通过:两表结构 + 唯一索引齐备(6/6)';
ELSE
  PRINT N'[FAIL] 自检异常:' + CAST(@ok AS nvarchar(3)) + N'/6,请检查';
GO
