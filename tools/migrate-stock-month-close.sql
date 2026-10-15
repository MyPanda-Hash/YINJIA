/* migrate-stock-month-close.sql — 库存**月结**:月结头/行表 + 结转行进出入库口径的隔离
 *
 * 【用户口径 2026-10-15(逐条)】
 *   ① 每月 1 号自动月结上个月;并有「上月月结 / 取消上月月结 / 重新月结」三个按钮;
 *   ② 按 (物料编码, 仓库编码, 批号) 汇总上月的入库数量(**包含上月结转过来的数据**);
 *   ③ 用上月所有入库数据**循环运算**,逐笔统计上月的出库汇总(先进先出分摊到入库批次,
 *      含「最晚出库日期」;缺批号的出库行回写分摊到的批号);
 *   ④ 写进 `inh` 生成**结转单据**;出库同款;
 *   ⑤ 入/出库计算三步:先统计本月出入库合计 → kucun 有则改、无则增 → 修改库存余量(幂等重算)。
 *
 * 【两处必须说清的口径(定了才敢动数据)】
 *   A. 结转行 = `inh` 里 `src=0` + `单据类型='月结结转'` + `单据编号='JZ-YYYYMM'` + `单据日期=次月1号`
 *      (rid 留空,不碰 `(src,rid)` 唯一索引)。**落在次月1号**是关键:这样「本月入库合计」天然包含
 *      上月结转来的量(同一期间内),与②的字面口径一致;若落在被结月份的月末,次月求和就漏掉它。
 *   B. ⚠ 结转行是**期间期初的记账标记,不是新的库存增加**。三张报表与成本引擎(v_stock_movement →
 *      v_stock_ledger / v_stock_balance / v_stock_summary + InvCostService)**都是对全部历史求和**,
 *      若把结转行算进去,库存会**逐月翻倍**(8月末 X → 9月再写一条 X → 累计 2X)。
 *      故本脚本把 `单据类型='月结结转'` 的行**在 v_stock_movement 里排除**(只改入库段的 WHERE):
 *      累计口径与成本口径**完全不变**,月结报表/展开明细另有取数(直接读 inh/outh)。
 *
 * ⚠ 视图定义有两份,必须逐字一致(历史脚本重放会把定义盖回去,2026-10-05 已踩过):
 *   `tools/migrate-stock-movement-from-flow-2026-09-30.sql`(原始定义)与**本脚本**(带排除)。
 *   两者都在各自文件里保留完整定义并交叉引用,改一处必须同步另一处。
 *
 * 幂等:表/索引/注明逐段判存在;视图用 CREATE OR ALTER。两账套都执行(先正式后测试)。
 */
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

/* ═══ ① 月结头表 ═══ */
IF OBJECT_ID(N'dbo.bd_stock_close', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.bd_stock_close (
    id            bigint IDENTITY(1,1) NOT NULL CONSTRAINT pk_bd_stock_close PRIMARY KEY,
    期间          nvarchar(7)   NOT NULL,             -- 被月结的月份 'YYYY-MM'
    状态          nvarchar(20)  NOT NULL,             -- 已月结 / 已取消
    结转单据编号   nvarchar(40)  NULL,                 -- JZ-YYYYMM(写进 inh 的结转单据号)
    结转日期      date          NULL,                 -- 结转行落点 = 次月 1 号
    行数          int           NULL,                 -- 本次月结涉及 (物料,仓库,批号) 键数
    入库合计      decimal(18,4) NULL,
    出库合计      decimal(18,4) NULL,
    结存合计      decimal(18,4) NULL,
    月结人        nvarchar(50)  NULL,
    月结时间      datetime2     NULL,
    取消人        nvarchar(50)  NULL,
    取消时间      datetime2     NULL,
    备注          nvarchar(400) NULL,
    asp_user1     nvarchar(50)  NULL,
    asp_time1     datetime2     NULL,
    asp_user2     nvarchar(50)  NULL,
    asp_time2     datetime2     NULL,
    asp_cancel    nvarchar(1)   NOT NULL CONSTRAINT df_bd_stock_close_cancel DEFAULT (N'N')
  );
  PRINT N'[OK] bd_stock_close 已建立';
END
ELSE PRINT N'[SKIP] bd_stock_close 已存在';
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.bd_stock_close') AND name = N'uq_bd_stock_close_期间')
  CREATE UNIQUE INDEX uq_bd_stock_close_期间 ON dbo.bd_stock_close(期间);
GO

/* ═══ ② 月结行表(每个 (物料,仓库,批号) 一行:期初/本期入/本期出/结存/单价/最晚出库日期) ═══ */
IF OBJECT_ID(N'dbo.bl_stock_close', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.bl_stock_close (
    id            bigint IDENTITY(1,1) NOT NULL CONSTRAINT pk_bl_stock_close PRIMARY KEY,
    头id          bigint        NOT NULL,             -- bd_stock_close.id
    行号          int           NULL,
    期间          nvarchar(7)   NOT NULL,
    物料编码      nvarchar(100) NOT NULL,
    物料名称      nvarchar(400) NULL,
    规格型号      nvarchar(400) NULL,
    计量单位      nvarchar(40)  NULL,
    仓库编码      nvarchar(100) NOT NULL,
    仓库名称      nvarchar(200) NULL,
    批号          nvarchar(120) NULL,
    期初数量      decimal(18,4) NULL,                 -- 上月结转来量(含更早月份的结转)
    入库数量      decimal(18,4) NULL,                 -- 本期间实际入库
    出库数量      decimal(18,4) NULL,                 -- 本期间实际出库
    结存数量      decimal(18,4) NULL,                 -- 期初 + 入库 − 出库(= 写进 inh 的结转数量)
    单价          decimal(18,4) NULL,
    最晚出库日期  date          NULL,                 -- FIFO 分摊后该批最后一次被发出的日期
    asp_user1     nvarchar(50)  NULL,
    asp_time1     datetime2     NULL,
    asp_user2     nvarchar(50)  NULL,
    asp_time2     datetime2     NULL,
    asp_cancel    nvarchar(1)   NOT NULL CONSTRAINT df_bl_stock_close_cancel DEFAULT (N'N')
  );
  PRINT N'[OK] bl_stock_close 已建立';
END
ELSE PRINT N'[SKIP] bl_stock_close 已存在';
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.bl_stock_close') AND name = N'ix_bl_stock_close_期间_键')
  CREATE INDEX ix_bl_stock_close_期间_键 ON dbo.bl_stock_close(期间, 物料编码, 仓库编码, 批号);
GO

/* ═══ ③ 中文注明(表级 + 关键列级;注意 class=1 过滤,否则会被索引级扩展属性撞号) ═══ */
DECLARE @tbl sysname, @col sysname, @txt nvarchar(400);
DECLARE @docs TABLE (tbl sysname, col sysname NULL, txt nvarchar(400));
INSERT INTO @docs VALUES
 (N'bd_stock_close', NULL, N'库存月结头表:一行 = 一个已月结(或被取消)的期间。结转行写进 inh(src=0/单据类型=月结结转),本表只记状态与合计;取消月结 = 标记本表 + 删该期间结转行'),
 (N'bd_stock_close', N'期间', N'被月结的月份,格式 YYYY-MM(如 2026-09)'),
 (N'bd_stock_close', N'状态', N'已月结 / 已取消'),
 (N'bd_stock_close', N'结转单据编号', N'写进 inh 的结转单据号,格式 JZ-YYYYMM'),
 (N'bd_stock_close', N'结转日期', N'结转行落点日期 = 被结月份的次月 1 号(这样次月「入库合计」天然含上月结转来的量)'),
 (N'bd_stock_close', N'行数', N'本次月结涉及的 (物料编码,仓库编码,批号) 键数'),
 (N'bd_stock_close', N'入库合计', N'被结期间实际入库合计(不含结转行自身)'),
 (N'bd_stock_close', N'出库合计', N'被结期间实际出库合计'),
 (N'bd_stock_close', N'结存合计', N'期末结存合计 = Σ(期初+本期入−本期出);未做 kucun 回写时仅作凭证'),
 (N'bl_stock_close', NULL, N'库存月结行表:一行 = 一个 (物料编码,仓库编码,批号) 在某个期间的期初/入/出/结存快照,供报表展开明细'),
 (N'bl_stock_close', N'头id', N'关联 bd_stock_close.id'),
 (N'bl_stock_close', N'期初数量', N'被结期间开始前的累计结存(= 上月结转来量)'),
 (N'bl_stock_close', N'入库数量', N'被结期间实际入库数量(inh,不含结转行)'),
 (N'bl_stock_close', N'出库数量', N'被结期间实际出库数量(outh)'),
 (N'bl_stock_close', N'结存数量', N'期末结存 = 期初+入库−出库;月结时按此数量写结转行、并按「幂等重算」口径回写 kucun'),
 (N'bl_stock_close', N'单价', N'结存单价:取该键最近一次入库的单价(kucun.price 同源),无则 NULL'),
 (N'bl_stock_close', N'最晚出库日期', N'FIFO 分摊后该批最后一次被发出的日期(缺批号出库行回写批号后仍为该日期)');

DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT tbl, col, txt FROM @docs;
OPEN cur;
FETCH NEXT FROM cur INTO @tbl, @col, @txt;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF @col IS NULL
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class = 1 AND ep.major_id = OBJECT_ID(N'dbo.' + @tbl) AND ep.minor_id = 0 AND ep.name = N'MS_Description')
      EXEC sp_addextendedproperty N'MS_Description', @txt, N'SCHEMA', N'dbo', N'TABLE', @tbl;
    ELSE
      EXEC sp_updateextendedproperty N'MS_Description', @txt, N'SCHEMA', N'dbo', N'TABLE', @tbl;
  END
  ELSE
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class = 1 AND ep.major_id = OBJECT_ID(N'dbo.' + @tbl)
                     AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.' + @tbl), @col, 'ColumnId') AND ep.name = N'MS_Description')
      EXEC sp_addextendedproperty N'MS_Description', @txt, N'SCHEMA', N'dbo', N'TABLE', @tbl, N'COLUMN', @col;
    ELSE
      EXEC sp_updateextendedproperty N'MS_Description', @txt, N'SCHEMA', N'dbo', N'TABLE', @tbl, N'COLUMN', @col;
  END
  FETCH NEXT FROM cur INTO @tbl, @col, @txt;
END
CLOSE cur; DEALLOCATE cur;
PRINT N'[注明] 月结两表的中文注明已就位';
GO

/* ═══ ④ v_stock_movement:排除月结结转行(定义与 migrate-stock-movement-from-flow-2026-09-30.sql 逐字一致,
        只多入库段 WHERE 的一句 `AND ISNULL(单据类型,N'') <> N'月结结转'`) ═══ */
CREATE OR ALTER VIEW dbo.v_stock_movement AS
SELECT m.src, m.rid, m.单据日期, m.单据类型, m.单据编号, m.业务类型,
       -- 仓库键 = 自身编码 → bs_wh 按名称兜底 → '#'+名称(三级兜底,表达式原样保留)
       ISNULL(ISNULL(m.自身仓库编码, w.仓库编码), N'#' + ISNULL(m.仓库名称, N'(未填仓库)')) AS 仓库键,
       ISNULL(m.自身仓库编码, w.仓库编码) AS 仓库编码,
       ISNULL(m.仓库名称, N'(未填仓库)') AS 仓库,
       m.存货编码, m.存货, m.规格型号, m.计量单位, m.批号,
       m.收入数量, m.发出数量, m.收入金额, m.发出单据金额, m.含税金额, m.税额,
       m.往来单位, m.往来单位编码, m.经手人
FROM (
  -- 入库流水(inh):src 0 期初结存 / 1 采购入库 / 2 产成品入库 / 3 其他入库 / 4 委外入库
  -- 2026-10-15 月结:排除「月结结转」行 —— 它是期间期初的记账标记,不是新的入库;
  --   算进累计口径会让库存逐月翻倍(见 migrate-stock-month-close.sql 头注 B)
  SELECT src,
         -- 期初行 rid 为 NULL ⇒ 用流水行自身 id 作合成键(见任务 4 的「rid 的两处坑」坑1)
         CAST(ISNULL(rid, id) AS int) AS rid,
         CAST(单据日期 AS date) AS 单据日期,
         CAST(单据类型 AS nvarchar(50)) AS 单据类型,
         CAST(单据编号 AS nvarchar(100)) AS 单据编号,
         N'入库' AS 业务类型,
         NULLIF(RTRIM(CAST(仓库编码 AS nvarchar(200))), N'') AS 自身仓库编码,
         CAST(仓库名称 AS nvarchar(200)) AS 仓库名称,
         ISNULL(NULLIF(RTRIM(CAST(物料编码 AS nvarchar(200))), N''), N'(未填存货)') AS 存货编码,
         CAST(物料名称 AS nvarchar(200)) AS 存货,
         CAST(规格型号 AS nvarchar(200)) AS 规格型号,
         CAST(计量单位 AS nvarchar(100)) AS 计量单位,
         ISNULL(NULLIF(RTRIM(CAST(批号 AS nvarchar(60))), N''), N'(未填批号)') AS 批号,
         CAST(数量 AS decimal(18,4)) AS 收入数量,
         CAST(0 AS decimal(18,4)) AS 发出数量,
         CAST(金额 AS decimal(18,4)) AS 收入金额,
         CAST(0 AS decimal(18,4)) AS 发出单据金额,
         -- 任务 7:透传(改前是 CAST(NULL AS decimal(18,4)),故这两列恒 NULL)
         CAST(含税金额 AS decimal(18,4)) AS 含税金额,
         CAST(税额 AS decimal(18,4)) AS 税额,
         CAST(往来单位 AS nvarchar(200)) AS 往来单位,
         CAST(NULL AS nvarchar(200)) AS 往来单位编码,
         CAST(经手人 AS nvarchar(200)) AS 经手人
    FROM dbo.inh WHERE ISNULL(asp_cancel, 'N') <> 'Y'
      AND ISNULL(单据类型, N'') <> N'月结结转'
  UNION ALL
  -- 出库流水(outh):src 5 销售出库 / 6 材料出库 / 7 其他出库 / 8 委外发料
  SELECT src, CAST(ISNULL(rid, id) AS int),
         CAST(单据日期 AS date),
         CAST(单据类型 AS nvarchar(50)),
         CAST(单据编号 AS nvarchar(100)),
         N'出库',
         NULLIF(RTRIM(CAST(仓库编码 AS nvarchar(200))), N''),
         CAST(仓库名称 AS nvarchar(200)),
         ISNULL(NULLIF(RTRIM(CAST(物料编码 AS nvarchar(200))), N''), N'(未填存货)'),
         CAST(物料名称 AS nvarchar(200)),
         CAST(规格型号 AS nvarchar(200)),
         CAST(计量单位 AS nvarchar(100)),
         ISNULL(NULLIF(RTRIM(CAST(批号 AS nvarchar(60))), N''), N'(未填批号)'),
         CAST(0 AS decimal(18,4)),
         CAST(数量 AS decimal(18,4)),
         CAST(0 AS decimal(18,4)),
         CAST(单据金额 AS decimal(18,4)),
         -- 任务 7:透传(同入库段)
         CAST(含税金额 AS decimal(18,4)),
         CAST(税额 AS decimal(18,4)),
         CAST(往来单位 AS nvarchar(200)),
         CAST(NULL AS nvarchar(200)),
         CAST(经手人 AS nvarchar(200))
    FROM dbo.outh WHERE ISNULL(asp_cancel, 'N') <> 'Y'
) m
-- 坑2:必须单行兜底。写成 LEFT JOIN 会因 bs_wh 同名多行把流水行翻倍(实测 62 vs 31)
OUTER APPLY (SELECT TOP 1 x.仓库编码 FROM dbo.bs_wh x WHERE x.仓库名称 = m.仓库名称 ORDER BY x.id) w;
GO

/* ═══ 自检 ═══ */
DECLARE @bad int = 0;
IF OBJECT_ID(N'dbo.bd_stock_close', N'U') IS NULL SET @bad = @bad + 1;
IF OBJECT_ID(N'dbo.bl_stock_close', N'U') IS NULL SET @bad = @bad + 1;
-- 两表必须有主键 + 审计四件套 + asp_cancel
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.bd_stock_close') AND is_primary_key = 1) SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.bl_stock_close') AND is_primary_key = 1) SET @bad = @bad + 1;
IF EXISTS (SELECT 1 FROM (VALUES (N'bd_stock_close'), (N'bl_stock_close')) AS t(tb)
           CROSS APPLY (VALUES (N'asp_user1'), (N'asp_time1'), (N'asp_user2'), (N'asp_time2'), (N'asp_cancel')) AS c(cl)
           WHERE NOT EXISTS (SELECT 1 FROM sys.columns x WHERE x.object_id = OBJECT_ID(N'dbo.' + t.tb) AND x.name = c.cl))
  SET @bad = @bad + 1;
-- 表级注明齐备
IF EXISTS (SELECT 1 FROM (VALUES (N'bd_stock_close'), (N'bl_stock_close')) AS t(tb)
           WHERE NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class = 1 AND ep.major_id = OBJECT_ID(N'dbo.' + t.tb)
                               AND ep.minor_id = 0 AND ep.name = N'MS_Description'
                               AND LEN(LTRIM(RTRIM(CAST(ep.value AS nvarchar(400))))) > 0))
  SET @bad = @bad + 1;
-- 视图已排除月结结转行(定义里必须有这一句;先剥行注释再比,免得注释里的字面量造成假 PASS/FAIL)
DECLARE @def nvarchar(max) = (SELECT OBJECT_DEFINITION(OBJECT_ID(N'dbo.v_stock_movement')));
IF @def IS NULL SET @bad = @bad + 1;
ELSE
BEGIN
  DECLARE @clean nvarchar(max) = @def;
  -- 逐行剥掉 `--` 之后的内容
  DECLARE @out nvarchar(max) = N'', @line nvarchar(400), @pos int;
  WHILE LEN(@clean) > 0
  BEGIN
    SET @pos = CHARINDEX(CHAR(10), @clean);
    IF @pos = 0 BEGIN SET @line = @clean; SET @clean = N''; END
    ELSE BEGIN SET @line = LEFT(@clean, @pos - 1); SET @clean = SUBSTRING(@clean, @pos + 1, LEN(@clean)); END
    SET @out = @out + CASE WHEN CHARINDEX(N'--', @line) > 0 THEN LEFT(@line, CHARINDEX(N'--', @line) - 1) ELSE @line END + CHAR(10);
  END
  IF @out NOT LIKE N'%月结结转%' SET @bad = @bad + 1;
END

DECLARE @dbn sysname = DB_NAME();
RAISERROR(N'[自检] %s:月结两表 + v_stock_movement 排除结转行;不符项 %d 条', 10, 1, @dbn, @bad);
IF @bad = 0
  RAISERROR(N'[OK] 库存月结表结构就位:bd_stock_close / bl_stock_close + 视图已隔离「月结结转」行', 10, 1);
ELSE
  RAISERROR(N'[FAIL] 月结迁移自检未过(见上一行数字)', 16, 1);
GO
